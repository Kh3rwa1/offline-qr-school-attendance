import { eq, sql } from 'drizzle-orm';
import { withSystemContext } from '../db';
import { retentionPolicies } from '../db/schema';
import { writeAuditLog } from '../services/auditLogService';

export async function runRetention(targetSchoolId?: string) {
  const policies = await withSystemContext((tx) =>
    targetSchoolId
      ? tx.select().from(retentionPolicies).where(eq(retentionPolicies.schoolId, targetSchoolId))
      : tx.select().from(retentionPolicies)
  );
  const results = [];

  for (const p of policies) {
    let scanEventsDeleted = 0;
    for (;;) {
      const r = await withSystemContext((tx) =>
        tx.execute(sql`
          DELETE FROM rfid_scan_events
           WHERE ctid IN (SELECT ctid FROM rfid_scan_events
                           WHERE school_id = ${p.schoolId}
                             AND scan_timestamp < now() - make_interval(days => ${p.scanEventsDays})
                           LIMIT 5000)`)
      );
      const count = r.rowCount ?? 0;
      scanEventsDeleted += count;
      if (count < 5000) break;
    }

    if (scanEventsDeleted > 0) {
      await writeAuditLog({
        schoolId: p.schoolId,
        actorId: null,
        action: 'RETENTION_PURGE',
        resourceType: 'RFID_SCAN_EVENTS',
        targetId: p.schoolId,
        metadata: { deleted: scanEventsDeleted, table: 'rfid_scan_events' },
      });
    }

    let notifsDeleted = 0;
    for (;;) {
      const r = await withSystemContext((tx) =>
        tx.execute(sql`
          DELETE FROM notification_jobs
           WHERE ctid IN (SELECT ctid FROM notification_jobs
                           WHERE school_id = ${p.schoolId}
                             AND queued_at < now() - make_interval(days => ${p.notificationLogDays})
                           LIMIT 5000)`)
      );
      const count = r.rowCount ?? 0;
      notifsDeleted += count;
      if (count < 5000) break;
    }

    if (notifsDeleted > 0) {
      await writeAuditLog({
        schoolId: p.schoolId,
        actorId: null,
        action: 'RETENTION_PURGE',
        resourceType: 'NOTIFICATION_JOBS',
        targetId: p.schoolId,
        metadata: { deleted: notifsDeleted, table: 'notification_jobs' },
      });
    }

    results.push({
      schoolId: p.schoolId,
      scanEventsDeleted,
      notificationsDeleted: notifsDeleted,
    });
  }

  return results;
}
