import { db } from '../db';
import { auditLogs } from '../db/schema';

export interface AuditLogParams {
  schoolId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export function sanitizeMetadata(data?: Record<string, any>): Record<string, any> | undefined {
  if (!data) return undefined;

  const sanitized = { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'sessionToken', 'qrDigest', 'secret'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (key.toLowerCase().includes('phone') && typeof sanitized[key] === 'string') {
      const p = sanitized[key];
      if (p.length >= 10) {
        sanitized[key] = `${p.slice(0, 3)}******${p.slice(-4)}`;
      }
    }
  }

  return sanitized;
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    const [inserted] = await db
      .insert(auditLogs)
      .values({
        schoolId: params.schoolId || null,
        actorId: params.actorId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: sanitizeMetadata(params.metadata),
      })
      .returning();

    return inserted;
  } catch (err) {
    console.error('Failed to write audit log:', err);
    return null;
  }
}
