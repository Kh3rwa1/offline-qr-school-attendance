import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const VALID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  // Trust upstream (Caddy) ID only if well-formed; otherwise mint one
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : crypto.randomUUID();
  (req as any).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
