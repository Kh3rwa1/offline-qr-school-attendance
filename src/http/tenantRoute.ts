import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { sql } from 'drizzle-orm';
import { withTenantContext, type Tx } from '../db';
import { resolveSchoolId } from '../middleware/resolveSchoolId';
import { AppError, toAppError } from '../errors/AppError';
import { assertMembership, type Role, type SessionUser, type SessionContext } from '../auth/session';

export interface RouteResult<T> {
  status?: number;
  data?: T;
  body?: unknown;
  contentType?: string;
  headers?: Record<string, string>;
}

interface Spec<P extends ZodType, Q extends ZodType, B extends ZodType, T> {
  roles: readonly (Role | string)[];
  params?: P;
  query?: Q;
  body?: B;
  /** Default true. Set false for read-only routes to use a READ ONLY transaction. */
  writes?: boolean;
  handler: (ctx: {
    tx: Tx;
    schoolId: string;
    user: SessionUser;
    params: z.infer<P>;
    query: z.infer<Q>;
    body: z.infer<B>;
    req: Request;
  }) => Promise<RouteResult<T>>;
}

const Empty = z.object({}).passthrough();

export function tenantRoute<
  P extends ZodType = typeof Empty,
  Q extends ZodType = typeof Empty,
  B extends ZodType = typeof Empty,
  T = unknown,
>(spec: Spec<P, Q, B, T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const sessionContext = (req as Request & { sessionContext?: SessionContext }).sessionContext;
      const user = sessionContext?.user;
      if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');

      const schoolId = resolveSchoolId(req) as string;
      const membership = await assertMembership(user, schoolId, spec.roles, sessionContext); // throws AppError 403

      (req as Request & { activeSchoolId?: string; userRole?: string }).activeSchoolId = schoolId;
      (req as Request & { activeSchoolId?: string; userRole?: string }).userRole = membership.role;

      const params = (spec.params ? parse(spec.params, req.params, 'params') : req.params) as z.infer<P>;
      const query = (spec.query ? parse(spec.query, req.query, 'query') : req.query) as z.infer<Q>;
      const body = (spec.body ? parse(spec.body, req.body ?? {}, 'body') : req.body) as z.infer<B>;

      const result = await withTenantContext(schoolId, async (tx) => {
        if (spec.writes === false) await tx.execute(sql`SET TRANSACTION READ ONLY`);
        return spec.handler({ tx, schoolId, user, params, query, body, req });
      });

      // Response sent ONLY after commit (preserves existing tenantHandler guarantee)
      if (res.headersSent) return;

      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v);
        }
      }
      if (result.contentType) {
        res.setHeader('Content-Type', result.contentType);
      }

      if (result.body !== undefined) {
        if (typeof result.body === 'string') {
          return res.status(result.status ?? 200).send(result.body);
        }
        return res.status(result.status ?? 200).json(result.body);
      }

      res.status(result.status ?? 200).json({ success: true, data: result.data });
    })().catch((err) => next(toAppError(err)));
  };
}

function parse<S extends ZodType>(schema: S, input: unknown, where: string): z.infer<S> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  throw new AppError('VALIDATION_FAILED', 400, 'Request validation failed', {
    internal: { where },
    // Public details: paths + codes only. NEVER echo submitted values (PII, tokens).
    details: r.error.issues.map((i) => ({ path: [where, ...i.path].join('.'), code: i.code })),
  });
}
