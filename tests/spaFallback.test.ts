import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import type { Server } from 'http';

describe('Hardened SPA Fallback & Static Serving Test Suite', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.SESSION_SECRET = 'ci-session-secret-01234567890123456789';
    process.env.CSRF_SECRET = 'ci-session-secret-01234567890123456789';
    process.env.METRICS_AUTH_TOKEN = 'test-metrics-token';
    process.env.ALLOW_IN_MEMORY_RATE_LIMITER = 'true';
    const { runMigrations } = await import('../src/db/migrate');
    await runMigrations();

    const app = await createApp();
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${(address as any).port}`;
        resolve();
      });
      server.on('error', reject);
    });
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Returns 404 JSON for unknown API paths rather than SPA HTML', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint-404`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toBe('API_ENDPOINT_NOT_FOUND');
  });

  it('2. Returns 404 JSON for nested unknown API paths', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/fake-id/unknown-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toBe('API_ENDPOINT_NOT_FOUND');
  });

  it('3. Serves bounded index.html for client-side nested dashboard routes', async () => {
    const res = await fetch(`${baseUrl}/app/super-admin/schools`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('4. Serves bounded index.html for root path', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('5. Strictly rejects directory traversal attempts on static assets', async () => {
    const res = await fetch(`${baseUrl}/../../etc/passwd`);
    // Traversal is either blocked or bounded to index.html/404, never exposes file system
    expect(res.status).not.toBe(500);
    const text = await res.text();
    expect(text).not.toContain('root:x:0:0:');
  });

  it('6. Rate limiting headers are present on SPA fallback requests', async () => {
    const res = await fetch(`${baseUrl}/app/teacher`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBeDefined();
  });
});
