import type { Request } from 'express';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*';

interface ExemptRule {
  readonly methods: readonly Method[];
  readonly pattern: RegExp;
  readonly reason: string; // forces you to justify every exemption
}

const rule = (methods: Method[], path: string, reason: string): ExemptRule => ({
  methods,
  // anchored, optional trailing slash (Express non-strict routing), case-insensitive like Express
  pattern: new RegExp(`^${path}/?$`, 'i'),
  reason,
});

export const CSRF_EXEMPT_RULES: readonly ExemptRule[] = Object.freeze([
  rule(['POST'], '/api/v1/notifications/callback', 'DLT provider webhook, HMAC-verified'),
  rule(['POST'], '/api/v1/auth/login', 'No session exists yet'),
  rule(['GET'], '/api/v1/auth/csrf', 'Token distribution'),
  rule(['GET'], '/api/v1/health(?:/[a-z]+)?', 'Health probes'),
  rule(['GET'], '/readyz', 'Readiness probe'),
  rule(['GET'], '/metrics', 'Bearer-authenticated scraper'),
  rule(['POST'], `/api/v1/schools/${UUID}/rfid/zebra/reads`, 'Zebra webhook, reader-authenticated, no cookies'),
  rule(['POST'], `/api/v1/schools/${UUID}/rfid/scans`, 'Gateway webhook, reader-authenticated, no cookies'),
]);

/** Path without query/fragment. Deliberately NOT decoded. */
export function requestPath(req: Request): string {
  const url = req.originalUrl || req.url || '';
  const q = url.search(/[?#]/);
  return q === -1 ? url : url.slice(0, q);
}

export function isCsrfExempt(req: Request): boolean {
  const path = requestPath(req);
  const method = req.method.toUpperCase() as Method;
  return CSRF_EXEMPT_RULES.some(
    (r) => (r.methods.includes('*') || r.methods.includes(method)) && r.pattern.test(path)
  );
}
