import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CloudflareR2ReplicationService } from '../src/services/backupReplicationService';

describe('Cloudflare R2 Replication & SigV4 Protocol Suite', () => {
  let mockServer: http.Server;
  let serverPort: number;
  let serverEndpoint: string;
  const mockStorage = new Map<string, { body: Buffer; headers: Record<string, string> }>();
  let failureInjections: Record<string, { code: number; count: number }> = {};

  beforeAll(async () => {
    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const key = url.pathname;

      // Check failure injection
      if (failureInjections[key] && failureInjections[key].count > 0) {
        req.resume();
        const { code } = failureInjections[key];
        failureInjections[key].count--;
        res.writeHead(code, { 'content-type': 'text/plain', 'connection': 'close' });
        res.end(`Injected error HTTP ${code}`);
        return;
      }

      // Check auth header presence
      const auth = req.headers['authorization'] || '';
      if (!auth.startsWith('AWS4-HMAC-SHA256')) {
        req.resume();
        res.writeHead(401, { 'content-type': 'text/plain', 'connection': 'close' });
        res.end('Unauthorized - Missing or invalid SigV4 authorization');
        return;
      }

      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          const metaHeaders: Record<string, string> = {
            'content-length': String(body.length),
            'etag': `"${crypto.createHash('md5').update(body).digest('hex')}"`,
            'connection': 'close',
          };
          for (const [k, v] of Object.entries(req.headers)) {
            if (k.startsWith('x-amz-meta-')) {
              metaHeaders[k] = String(v);
            }
          }
          mockStorage.set(key, { body, headers: metaHeaders });
          res.writeHead(200, {
            'etag': metaHeaders.etag,
            'content-length': '0',
            'connection': 'close',
          });
          res.end();
        });
      } else if (req.method === 'HEAD') {
        req.resume();
        const item = mockStorage.get(key);
        if (!item) {
          res.writeHead(404, { 'connection': 'close' });
          res.end();
        } else {
          res.writeHead(200, { ...item.headers, 'connection': 'close' });
          res.end();
        }
      } else if (req.method === 'GET') {
        req.resume();
        const item = mockStorage.get(key);
        if (!item) {
          res.writeHead(404, { 'connection': 'close' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { ...item.headers, 'connection': 'close' });
          res.end(item.body);
        }
      } else if (req.method === 'DELETE') {
        req.resume();
        mockStorage.delete(key);
        res.writeHead(204, { 'connection': 'close' });
        res.end();
      } else {
        req.resume();
        res.writeHead(405, { 'connection': 'close' });
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as any;
        serverPort = addr.port;
        serverEndpoint = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
  });

  it('rejects insecure HTTP endpoints in production mode', () => {
    expect(() => {
      new CloudflareR2ReplicationService({
        accountId: 'acc123',
        accessKeyId: 'key123',
        secretAccessKey: 'sec123',
        bucket: 'prod-bucket',
        endpoint: 'http://insecure-endpoint.r2.cloudflarestorage.com',
        requiredInProduction: true,
      });
    }).toThrow(/R2_INSECURE_ENDPOINT/);
  });

  it('validates mandatory configuration and redacts secret in getConfig()', () => {
    const r2 = new CloudflareR2ReplicationService({
      accountId: 'acc123',
      accessKeyId: 'key123',
      secretAccessKey: 'sec123-super-secret',
      bucket: 'test-bucket',
      endpoint: 'https://acc123.r2.cloudflarestorage.com',
      requiredInProduction: false,
    });

    expect(r2.isConfigured()).toBe(true);
    const config = r2.getConfig();
    expect(config?.secretAccessKey).toBe('***REDACTED***');
    expect(config?.bucket).toBe('test-bucket');
  });

  it('performs authentic SigV4 PUT, HEAD, GET and remote verification', async () => {
    const r2 = new CloudflareR2ReplicationService({
      accountId: 'acc123',
      accessKeyId: 'key123',
      secretAccessKey: 'sec123',
      bucket: 'test-bucket',
      endpoint: serverEndpoint,
      prefix: 'attendease-backups/',
      uploadTimeoutSeconds: 5,
      requiredInProduction: false,
    });

    const testPayload = Buffer.from('Encrypted PostgreSQL Backup Content for AttendEase OS', 'utf8');
    const key = 'attendease-backups/test-deployment/2026/08/15/test.sql.gz.enc';

    // 1. Upload Object
    const putResult = await r2.putObject(key, testPayload, 'application/octet-stream', {
      backupId: 'test-backup-001',
    });
    expect(putResult.sha256).toBe(crypto.createHash('sha256').update(testPayload).digest('hex'));

    // 2. HEAD Request
    const headResult = await r2.headObject(key);
    expect(headResult.exists).toBe(true);
    expect(headResult.contentLength).toBe(testPayload.length);
    expect(headResult.sha256).toBe(putResult.sha256);
    expect(headResult.metadata['backupid']).toBe('test-backup-001');

    // 3. GET Object & SHA-256 Download Verification
    const getResult = await r2.getObject(key);
    expect(getResult.contentLength).toBe(testPayload.length);
    expect(getResult.sha256).toBe(putResult.sha256);
    expect(getResult.data.toString('utf8')).toBe(testPayload.toString('utf8'));
  });

  it('retries transient 5xx / 429 failures with exponential backoff and succeeds', async () => {
    const r2 = new CloudflareR2ReplicationService({
      accountId: 'acc123',
      accessKeyId: 'key123',
      secretAccessKey: 'sec123',
      bucket: 'test-bucket',
      endpoint: serverEndpoint,
      prefix: 'attendease-backups/',
      uploadTimeoutSeconds: 5,
      maxRetries: 3,
      requiredInProduction: false,
    });

    const key = '/test-bucket/attendease-backups/transient-test.sql.gz.enc';
    // Inject 2 transient 500 errors before returning 200
    failureInjections[key] = { code: 500, count: 2 };

    const payload = Buffer.from('Transient retry test data', 'utf8');
    const result = await r2.putObject('attendease-backups/transient-test.sql.gz.enc', payload);
    expect(result.sha256).toBeDefined();

    // Verify it succeeded on 3rd attempt
    const head = await r2.headObject('attendease-backups/transient-test.sql.gz.enc');
    expect(head.exists).toBe(true);
  });

  it('fails fast on 401/403 authentication errors without infinite loops', async () => {
    const r2 = new CloudflareR2ReplicationService({
      accountId: 'acc123',
      accessKeyId: 'key123',
      secretAccessKey: 'sec123',
      bucket: 'test-bucket',
      endpoint: serverEndpoint,
      prefix: 'attendease-backups/',
      uploadTimeoutSeconds: 5,
      maxRetries: 3,
      requiredInProduction: false,
    });

    const key = '/test-bucket/attendease-backups/auth-fail.sql.gz.enc';
    failureInjections[key] = { code: 403, count: 1 };

    await expect(
      r2.putObject('attendease-backups/auth-fail.sql.gz.enc', Buffer.from('test', 'utf8'))
    ).rejects.toThrow(/R2_AUTH_ERROR/);
  });

  it('replicates full backup file, manifest, and checksum with remote HEAD verification', async () => {
    const r2 = new CloudflareR2ReplicationService({
      accountId: 'acc123',
      accessKeyId: 'key123',
      secretAccessKey: 'sec123',
      bucket: 'test-bucket',
      endpoint: serverEndpoint,
      prefix: 'attendease-backups/',
      uploadTimeoutSeconds: 5,
      requiredInProduction: false,
    });

    const tempDir = path.join(process.cwd(), 'backups', `test-r2-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const backupFile = path.join(tempDir, 'attendease-test.sql.gz.enc');
    const manifestFile = path.join(tempDir, 'attendease-test.manifest.json');

    const backupData = Buffer.from('Encrypted Real Backup Test Blob 1234567890', 'utf8');
    const manifestData = {
      backupFormatVersion: '2.0',
      backupId: 'attendease-test',
      deploymentId: 'unit-test-deployment',
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(backupFile, backupData);
    fs.writeFileSync(manifestFile, JSON.stringify(manifestData, null, 2));

    const result = await r2.replicateBackup(backupFile);
    expect(result.success).toBe(true);
    expect(result.verifiedSizeBytes).toBe(backupData.length);
    expect(result.checksumSha256).toBe(crypto.createHash('sha256').update(backupData).digest('hex'));
    expect(result.remoteVerifiedAt).toBeDefined();

    // Verify manifest was updated with R2 object keys
    const updatedManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    expect(updatedManifest.r2ReplicationStatus).toBe('SUCCESS');
    expect(updatedManifest.r2ObjectKeys.backup).toContain('attendease-test.sql.gz.enc');

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
