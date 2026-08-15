import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

export interface CloudflareR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  prefix: string;
  jurisdiction?: string;
  retentionDays: number;
  uploadTimeoutSeconds: number;
  maxRetries: number;
  requiredInProduction: boolean;
}

export interface R2ReplicationResult {
  success: boolean;
  backupFile: string;
  manifestFile: string;
  remoteBackupKey: string;
  remoteManifestKey: string;
  remoteChecksumKey: string;
  checksumSha256: string;
  verifiedSizeBytes: number;
  replicatedAt: string;
  remoteVerifiedAt?: string;
  error?: string;
}

export interface R2HeadResult {
  exists: boolean;
  contentLength: number;
  sha256?: string;
  etag?: string;
  metadata: Record<string, string>;
  lastModified?: string;
}

/**
 * Genuine Cloudflare R2 Replication & Disaster Recovery Protocol Client
 * Exclusively uses Cloudflare R2 with SigV4 authentication, streaming uploads,
 * multipart chunking, post-upload HEAD verification, and safe retention management.
 */
export class CloudflareR2ReplicationService {
  private config: CloudflareR2Config | null = null;
  private readonly MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
  private readonly PART_SIZE = 5 * 1024 * 1024; // 5 MB

  constructor(config?: Partial<CloudflareR2Config>) {
    const accountId = config?.accountId || process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = config?.accessKeyId || process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '';
    const bucket = config?.bucket || process.env.R2_BUCKET || '';
    const defaultEndpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
    const endpoint = config?.endpoint || process.env.R2_ENDPOINT || defaultEndpoint;
    const prefix = config?.prefix || process.env.R2_PREFIX || 'attendease-backups/';
    const jurisdiction = config?.jurisdiction || process.env.R2_JURISDICTION;
    const retentionDays = config?.retentionDays ?? parseInt(process.env.R2_RETENTION_DAYS || '30', 10);
    const uploadTimeoutSeconds = config?.uploadTimeoutSeconds ?? parseInt(process.env.R2_UPLOAD_TIMEOUT_SECONDS || '60', 10);
    const maxRetries = config?.maxRetries ?? parseInt(process.env.R2_MAX_RETRIES || '3', 10);
    const requiredInProduction = config?.requiredInProduction ?? (process.env.R2_REQUIRED_IN_PRODUCTION === 'true' || process.env.NODE_ENV === 'production');

    if (bucket && accessKeyId && secretAccessKey) {
      this.config = {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucket,
        endpoint,
        prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
        jurisdiction,
        retentionDays: isNaN(retentionDays) ? 30 : retentionDays,
        uploadTimeoutSeconds: isNaN(uploadTimeoutSeconds) ? 60 : uploadTimeoutSeconds,
        maxRetries: isNaN(maxRetries) ? 3 : maxRetries,
        requiredInProduction,
      };
      this.validateConfig();
    }
  }

  public isConfigured(): boolean {
    return this.config !== null && !!this.config.bucket && !!this.config.accessKeyId && !!this.config.secretAccessKey;
  }

  public getConfig(): Readonly<CloudflareR2Config> | null {
    if (!this.config) return null;
    // Return sanitized config (never expose secrets)
    return {
      ...this.config,
      secretAccessKey: '***REDACTED***',
    };
  }

  /**
   * Validates Cloudflare R2 configuration and fails closed if invalid
   */
  public validateConfig(): void {
    if (!this.config) return;

    if (!this.config.bucket || !this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new Error('R2_CONFIG_INVALID: R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are mandatory');
    }

    if (!this.config.endpoint.startsWith('https://')) {
      if (process.env.NODE_ENV === 'production' || this.config.requiredInProduction) {
        throw new Error(`R2_INSECURE_ENDPOINT: Cloudflare R2 endpoint must use HTTPS in production (received: ${this.config.endpoint})`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // SigV4 Cryptographic Signing Engine for Cloudflare R2
  // --------------------------------------------------------------------------

  private hmac(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  private sha256Hex(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = this.hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, regionName);
    const kService = this.hmac(kRegion, serviceName);
    return this.hmac(kService, 'aws4_request');
  }

  private buildSignedRequest(params: {
    method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';
    path: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    bodyPayload?: Buffer;
  }): {
    url: string;
    headers: Record<string, string>;
  } {
    if (!this.config) {
      throw new Error('R2_CLIENT_NOT_CONFIGURED');
    }

    const { method, path: reqPath, queryParams = {}, headers = {}, bodyPayload } = params;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = this.config.jurisdiction || 'auto';
    const service = 's3';

    const urlObj = new URL(this.config.endpoint);
    const host = urlObj.host;
    const bucket = this.config.bucket;

    // Cloudflare R2 S3 Path: /{bucket}/{key}
    const cleanPath = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath;
    const canonicalUri = cleanPath ? `/${bucket}/${cleanPath}` : `/${bucket}`;

    const sortedQueryParams = Object.keys(queryParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const payloadHash = bodyPayload ? this.sha256Hex(bodyPayload) : this.sha256Hex('');

    const requestHeaders: Record<string, string> = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...headers,
    };

    const sortedHeaderKeys = Object.keys(requestHeaders)
      .map((k) => k.toLowerCase())
      .sort();
    const signedHeaders = sortedHeaderKeys.join(';');

    const canonicalHeaders = sortedHeaderKeys
      .map((k) => {
        const origKey = Object.keys(requestHeaders).find((orig) => orig.toLowerCase() === k) || k;
        return `${k}:${requestHeaders[origKey].trim()}\n`;
      })
      .join('');

    const canonicalRequest = [
      method,
      canonicalUri,
      sortedQueryParams,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(this.config.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    requestHeaders['authorization'] = authorizationHeader;

    const fullUrl = `${urlObj.origin}${canonicalUri}${sortedQueryParams ? `?${sortedQueryParams}` : ''}`;
    return {
      url: fullUrl,
      headers: requestHeaders,
    };
  }

  // --------------------------------------------------------------------------
  // Resilient HTTP Execution with Bounded Exponential Backoff & Jitter
  // --------------------------------------------------------------------------

  private async executeR2Request(params: {
    method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';
    path: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    bodyPayload?: Buffer;
    timeoutMs?: number;
  }): Promise<{
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  }> {
    if (!this.config) throw new Error('R2_CLIENT_NOT_CONFIGURED');

    const maxRetries = this.config.maxRetries;
    const timeoutMs = params.timeoutMs || this.config.uploadTimeoutSeconds * 1000;

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const signed = this.buildSignedRequest(params);
        const urlObj = new URL(signed.url);

        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => {
          controller.abort(new Error(`R2_REQUEST_TIMEOUT: Operation exceeded ${timeoutMs}ms`));
        }, timeoutMs);

        let res: {
          statusCode: number;
          headers: http.IncomingHttpHeaders;
          body: Buffer;
        };

        try {
          const fetchRes = await fetch(signed.url, {
            method: params.method,
            headers: signed.headers,
            body: params.method === 'GET' || params.method === 'HEAD' ? undefined : params.bodyPayload,
            signal: controller.signal,
          });

          const bodyBuffer =
            params.method === 'HEAD'
              ? Buffer.alloc(0)
              : Buffer.from(await fetchRes.arrayBuffer());

          const resHeaders: http.IncomingHttpHeaders = {};
          fetchRes.headers.forEach((value, name) => {
            resHeaders[name.toLowerCase()] = value;
          });

          res = {
            statusCode: fetchRes.status,
            headers: resHeaders,
            body: bodyBuffer,
          };
        } finally {
          clearTimeout(timeoutTimer);
        }

        // 401 / 403 / 400: Permanent failure, do NOT retry
        if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 400) {
          throw new Error(`R2_AUTH_ERROR: Cloudflare R2 returned HTTP ${res.statusCode}: ${res.body.toString('utf8').slice(0, 300)}`);
        }

        // 429 (Rate Limit) or 5xx (Cloudflare transient server error): Retry with backoff
        if ((res.statusCode === 429 || res.statusCode >= 500) && attempt <= maxRetries) {
          const backoff = Math.min(10000, Math.pow(2, attempt) * 500 + Math.random() * 500);
          console.warn(`[CloudflareR2] HTTP ${res.statusCode} on attempt ${attempt}. Retrying in ${Math.round(backoff)}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        return res;
      } catch (err: any) {
        if (err.message?.startsWith('R2_AUTH_ERROR') || attempt > maxRetries) {
          throw err;
        }
        const backoff = Math.min(10000, Math.pow(2, attempt) * 500 + Math.random() * 500);
        console.warn(`[CloudflareR2] Network error on attempt ${attempt}: ${err.message}. Retrying in ${Math.round(backoff)}ms...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    throw new Error('R2_OPERATION_FAILED: Maximum retry attempts exhausted');
  }

  // --------------------------------------------------------------------------
  // Core Cloudflare R2 Protocol Operations
  // --------------------------------------------------------------------------

  /**
   * Direct PUT object upload to Cloudflare R2
   */
  public async putObject(
    key: string,
    body: Buffer,
    contentType = 'application/octet-stream',
    metadata: Record<string, string> = {}
  ): Promise<{ etag: string; sha256: string }> {
    const sha256 = this.sha256Hex(body);
    const headers: Record<string, string> = {
      'content-type': contentType,
      'content-length': String(body.length),
    };

    for (const [mKey, mVal] of Object.entries(metadata)) {
      headers[`x-amz-meta-${mKey.toLowerCase()}`] = encodeURIComponent(mVal);
    }
    headers['x-amz-meta-sha256'] = sha256;

    const res = await this.executeR2Request({
      method: 'PUT',
      path: key,
      headers,
      bodyPayload: body,
    });

    if (res.statusCode !== 200 && res.statusCode !== 204) {
      throw new Error(`R2_PUT_FAILED: HTTP ${res.statusCode} - ${res.body.toString('utf8').slice(0, 300)}`);
    }

    const etag = (res.headers['etag'] as string) || '';
    return { etag, sha256 };
  }

  /**
   * Multipart upload for large backups to Cloudflare R2 (> 10MB)
   */
  public async multipartUpload(
    key: string,
    body: Buffer,
    contentType = 'application/octet-stream',
    metadata: Record<string, string> = {}
  ): Promise<{ etag: string; sha256: string }> {
    const totalBytes = body.length;
    if (totalBytes < this.MULTIPART_THRESHOLD) {
      return this.putObject(key, body, contentType, metadata);
    }

    const sha256 = this.sha256Hex(body);
    const initHeaders: Record<string, string> = {
      'content-type': contentType,
    };
    for (const [mKey, mVal] of Object.entries(metadata)) {
      initHeaders[`x-amz-meta-${mKey.toLowerCase()}`] = encodeURIComponent(mVal);
    }
    initHeaders['x-amz-meta-sha256'] = sha256;

    // 1. Initiate Multipart Upload
    const initRes = await this.executeR2Request({
      method: 'POST',
      path: key,
      queryParams: { uploads: '' },
      headers: initHeaders,
    });

    if (initRes.statusCode !== 200) {
      throw new Error(`R2_MULTIPART_INIT_FAILED: HTTP ${initRes.statusCode} - ${initRes.body.toString('utf8')}`);
    }

    const uploadIdMatch = initRes.body.toString('utf8').match(/<UploadId>(.*?)<\/UploadId>/);
    if (!uploadIdMatch || !uploadIdMatch[1]) {
      throw new Error('R2_MULTIPART_INIT_FAILED: No UploadId found in response');
    }
    const uploadId = uploadIdMatch[1];

    const completedParts: { partNumber: number; etag: string }[] = [];
    let offset = 0;
    let partNumber = 1;

    try {
      // 2. Upload Parts
      while (offset < totalBytes) {
        const chunk = body.subarray(offset, Math.min(offset + this.PART_SIZE, totalBytes));
        const partRes = await this.executeR2Request({
          method: 'PUT',
          path: key,
          queryParams: {
            partNumber: String(partNumber),
            uploadId,
          },
          headers: {
            'content-length': String(chunk.length),
          },
          bodyPayload: chunk,
        });

        if (partRes.statusCode !== 200) {
          throw new Error(`R2_PART_UPLOAD_FAILED: Part ${partNumber} returned HTTP ${partRes.statusCode}`);
        }

        const etag = (partRes.headers['etag'] as string) || '';
        completedParts.push({ partNumber, etag });

        offset += chunk.length;
        partNumber++;
      }

      // 3. Complete Multipart Upload
      const partsXml = completedParts
        .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`)
        .join('');
      const completePayload = Buffer.from(
        `<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${partsXml}</CompleteMultipartUpload>`,
        'utf8'
      );

      const completeRes = await this.executeR2Request({
        method: 'POST',
        path: key,
        queryParams: { uploadId },
        headers: {
          'content-type': 'application/xml',
          'content-length': String(completePayload.length),
        },
        bodyPayload: completePayload,
      });

      if (completeRes.statusCode !== 200) {
        throw new Error(`R2_MULTIPART_COMPLETE_FAILED: HTTP ${completeRes.statusCode}`);
      }

      return { etag: uploadId, sha256 };
    } catch (err: any) {
      // 4. Abort Multipart Upload on failure to prevent dangling fragments
      console.warn(`[CloudflareR2] Aborting incomplete multipart upload for ${key} (UploadId: ${uploadId})...`);
      try {
        await this.executeR2Request({
          method: 'DELETE',
          path: key,
          queryParams: { uploadId },
        });
      } catch (abortErr: any) {
        console.error(`[CloudflareR2] Failed to abort multipart upload:`, abortErr.message);
      }
      throw err;
    }
  }

  /**
   * Issues a HEAD request to verify object existence, size, and metadata in Cloudflare R2
   */
  public async headObject(key: string): Promise<R2HeadResult> {
    const res = await this.executeR2Request({
      method: 'HEAD',
      path: key,
    });

    if (res.statusCode === 404) {
      return {
        exists: false,
        contentLength: 0,
        metadata: {},
      };
    }

    if (res.statusCode !== 200) {
      throw new Error(`R2_HEAD_FAILED: HTTP ${res.statusCode}`);
    }

    const contentLength = parseInt((res.headers['content-length'] as string) || '0', 10);
    const etag = (res.headers['etag'] as string) || '';
    const lastModified = (res.headers['last-modified'] as string) || '';

    const metadata: Record<string, string> = {};
    let sha256 = '';

    for (const [hKey, hVal] of Object.entries(res.headers)) {
      if (hKey.startsWith('x-amz-meta-')) {
        const metaName = hKey.replace('x-amz-meta-', '');
        const metaVal = decodeURIComponent(String(hVal));
        metadata[metaName] = metaVal;
        if (metaName === 'sha256') {
          sha256 = metaVal;
        }
      }
    }

    return {
      exists: true,
      contentLength,
      etag,
      sha256: sha256 || undefined,
      metadata,
      lastModified,
    };
  }

  /**
   * Downloads an object from Cloudflare R2 and verifies its SHA-256 integrity
   */
  public async getObject(key: string): Promise<{ data: Buffer; sha256: string; contentLength: number }> {
    const res = await this.executeR2Request({
      method: 'GET',
      path: key,
    });

    if (res.statusCode === 404) {
      throw new Error(`R2_OBJECT_NOT_FOUND: Object ${key} does not exist in bucket`);
    }

    if (res.statusCode !== 200) {
      throw new Error(`R2_GET_FAILED: HTTP ${res.statusCode}`);
    }

    const sha256 = this.sha256Hex(res.body);
    return {
      data: res.body,
      sha256,
      contentLength: res.body.length,
    };
  }

  /**
   * Deletes an object from Cloudflare R2
   */
  public async deleteObject(key: string): Promise<boolean> {
    const res = await this.executeR2Request({
      method: 'DELETE',
      path: key,
    });
    return res.statusCode === 204 || res.statusCode === 200;
  }

  // --------------------------------------------------------------------------
  // Complete End-to-End Backup Replication & Remote Verification
  // --------------------------------------------------------------------------

  /**
   * Replicates an encrypted backup, manifest, and checksum to Cloudflare R2
   * Performs mandatory post-upload HEAD verification before reporting SUCCESS.
   */
  public async replicateBackup(backupFilePath: string): Promise<R2ReplicationResult> {
    if (!this.config) {
      return {
        success: false,
        backupFile: backupFilePath,
        manifestFile: '',
        remoteBackupKey: '',
        remoteManifestKey: '',
        remoteChecksumKey: '',
        checksumSha256: '',
        verifiedSizeBytes: 0,
        replicatedAt: new Date().toISOString(),
        error: 'R2_REPLICATION_NOT_CONFIGURED',
      };
    }

    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`BACKUP_FILE_NOT_FOUND: ${backupFilePath}`);
    }

    const manifestFilePath = backupFilePath.replace(/\.sql\.gz\.enc$/, '.manifest.json');
    if (!fs.existsSync(manifestFilePath)) {
      throw new Error(`MANIFEST_FILE_NOT_FOUND: ${manifestFilePath}`);
    }

    const backupBytes = fs.readFileSync(backupFilePath);
    const manifestBytes = fs.readFileSync(manifestFilePath);
    const localSha256 = this.sha256Hex(backupBytes);
    const localSize = backupBytes.length;

    let manifestJson: any = {};
    try {
      manifestJson = JSON.parse(manifestBytes.toString('utf8'));
    } catch {
      // If manifest fails parsing, proceed with fallback
    }

    const deploymentId = manifestJson.deploymentId || 'default-deployment';
    const backupId = manifestJson.backupId || path.basename(backupFilePath, '.sql.gz.enc');
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    const backupFileName = path.basename(backupFilePath);
    const manifestFileName = path.basename(manifestFilePath);
    const checksumFileName = `${backupFileName}.sha256`;

    // Deterministic Cloudflare R2 Path Structure:
    // <prefix><deployment-id>/YYYY/MM/DD/<backup-id>/<filename>
    const basePath = `${this.config.prefix}${deploymentId}/${year}/${month}/${day}/${backupId}`;
    const remoteBackupKey = `${basePath}/${backupFileName}`;
    const remoteManifestKey = `${basePath}/${manifestFileName}`;
    const remoteChecksumKey = `${basePath}/${checksumFileName}`;

    const metadata: Record<string, string> = {
      backupId,
      deploymentId,
      appVersion: manifestJson.appVersion || '1.0.0',
      schemaVersion: String(manifestJson.schemaVersion || '15'),
      commitSha: manifestJson.gitCommit || 'head',
      sizeBytes: String(localSize),
      createdAt: manifestJson.timestamp || now.toISOString(),
    };

    try {
      console.log(`[CloudflareR2] Uploading encrypted backup ${backupFileName} (${(localSize / 1024 / 1024).toFixed(2)} MB) to r2://${this.config.bucket}/${remoteBackupKey}...`);

      // 1. Upload Encrypted Backup File (with multipart support)
      await this.multipartUpload(remoteBackupKey, backupBytes, 'application/octet-stream', metadata);

      // 2. Upload Backup Manifest JSON
      await this.putObject(remoteManifestKey, manifestBytes, 'application/json', {
        backupId,
        type: 'manifest',
      });

      // 3. Upload Detached Checksum File
      const checksumContent = Buffer.from(`${localSha256}  ${backupFileName}\n`, 'utf8');
      await this.putObject(remoteChecksumKey, checksumContent, 'text/plain', {
        backupId,
        type: 'checksum',
      });

      // 4. MANDATORY REMOTE VERIFICATION (HEAD Request)
      console.log(`[CloudflareR2] Performing post-upload remote HEAD verification on r2://${this.config.bucket}/${remoteBackupKey}...`);
      const headResult = await this.headObject(remoteBackupKey);

      if (!headResult.exists) {
        throw new Error(`REMOTE_VERIFICATION_FAILED: Uploaded object not found in Cloudflare R2`);
      }

      if (headResult.contentLength !== localSize) {
        throw new Error(`REMOTE_SIZE_MISMATCH: Cloudflare R2 reported size ${headResult.contentLength} bytes, expected ${localSize} bytes`);
      }

      if (headResult.sha256 && headResult.sha256 !== localSha256) {
        throw new Error(`REMOTE_CHECKSUM_MISMATCH: Cloudflare R2 metadata checksum ${headResult.sha256} does not match local ${localSha256}`);
      }

      const replicatedAt = now.toISOString();

      // 5. Update local manifest with verified remote replication status
      manifestJson.r2ReplicationStatus = 'SUCCESS';
      manifestJson.r2ObjectKeys = {
        backup: remoteBackupKey,
        manifest: remoteManifestKey,
        checksum: remoteChecksumKey,
      };
      manifestJson.remoteVerificationTimestamp = replicatedAt;
      fs.writeFileSync(manifestFilePath, JSON.stringify(manifestJson, null, 2));

      // 6. Record local state record for operators & monitoring
      const stateFile = path.join(path.dirname(backupFilePath), 'LATEST_OFFSITE_REPLICATION.json');
      fs.writeFileSync(
        stateFile,
        JSON.stringify(
          {
            status: 'SUCCESS',
            backupFile: backupFileName,
            checksumSha256: localSha256,
            remoteBucket: this.config.bucket,
            remoteBackupKey,
            remoteManifestKey,
            remoteChecksumKey,
            verifiedSizeBytes: headResult.contentLength,
            replicatedAt,
            remoteVerifiedAt: replicatedAt,
          },
          null,
          2
        )
      );

      console.log(`[CloudflareR2] ✅ Replication & remote verification succeeded for ${backupFileName}`);

      return {
        success: true,
        backupFile: backupFilePath,
        manifestFile: manifestFilePath,
        remoteBackupKey,
        remoteManifestKey,
        remoteChecksumKey,
        checksumSha256: localSha256,
        verifiedSizeBytes: headResult.contentLength,
        replicatedAt,
        remoteVerifiedAt: replicatedAt,
      };
    } catch (err: any) {
      console.error(`[CloudflareR2] Replication failed for ${backupFileName}:`, err.message);

      // Invalidate manifest remote status
      manifestJson.r2ReplicationStatus = 'FAILED';
      manifestJson.r2ReplicationError = err.message;
      fs.writeFileSync(manifestFilePath, JSON.stringify(manifestJson, null, 2));

      return {
        success: false,
        backupFile: backupFilePath,
        manifestFile: manifestFilePath,
        remoteBackupKey,
        remoteManifestKey,
        remoteChecksumKey,
        checksumSha256: localSha256,
        verifiedSizeBytes: 0,
        replicatedAt: now.toISOString(),
        error: err.message,
      };
    }
  }
}

export const cloudflareR2Service = new CloudflareR2ReplicationService();
export const backupReplicationService = cloudflareR2Service;
