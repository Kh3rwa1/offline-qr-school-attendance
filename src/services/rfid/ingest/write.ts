import { and, eq, inArray, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  attendanceSessions,
  attendanceRecords,
  attendanceEvents,
  rfidScanEvents,
} from '../../../db/schema';
import { DUPLICATE_DECISIONS, type IngestContext, type Outcome } from './types';
import type { Tx } from '../../../db';

export async function writeOutcomes(
  tx: Tx,
  ctx: IngestContext,
  outcomes: Outcome[],
  reader: { id: string }
): Promise<Outcome[]> {
  const accepted = outcomes.filter((o) => o.decision === 'ACCEPTED');

  // ── Step A: ensure sessions exist (race-safe) ─────────────────────────────
  const sessionIdBySection = new Map([...ctx.sessionBySection].map(([k, v]) => [k, v.id]));
  const missing: string[] = Array.from(new Set<string>(accepted.filter((o) => o.needsSession).map((o) => o.classSectionId!)));

  if (missing.length) {
    await tx
      .insert(attendanceSessions)
      .values(
        missing.sort().map((sectionId) => ({
          schoolId: ctx.schoolId,
          classSectionId: sectionId,
          sessionDate: ctx.schoolDate,
          sessionType: 'GATE_ARRIVAL',
          status: 'OPEN',
          teacherId: ctx.teacherBySection.get(sectionId)!,
        }))
      )
      .onConflictDoNothing({
        target: [
          attendanceSessions.schoolId,
          attendanceSessions.classSectionId,
          attendanceSessions.sessionDate,
          attendanceSessions.sessionType,
        ],
      });

    // Re-select: picks up rows we inserted AND rows a concurrent batch inserted
    const rows = await tx
      .select({
        id: attendanceSessions.id,
        classSectionId: attendanceSessions.classSectionId,
        status: attendanceSessions.status,
      })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.schoolId, ctx.schoolId),
          inArray(attendanceSessions.classSectionId, missing),
          eq(attendanceSessions.sessionDate, ctx.schoolDate),
          eq(attendanceSessions.sessionType, 'GATE_ARRIVAL')
        )
      );

    for (const r of rows) {
      if (r.status === 'FINALIZED') {
        // Finalized between our load and now: downgrade those reads
        for (const o of accepted) {
          if (o.classSectionId === r.classSectionId) o.decision = 'SESSION_FINALIZED';
        }
      } else {
        sessionIdBySection.set(r.classSectionId, r.id);
      }
    }
  }

  for (const o of accepted) {
    if (o.decision !== 'ACCEPTED') continue;
    if (!sessionIdBySection.has(o.classSectionId!)) {
      o.decision = 'NO_ACTIVE_SESSION';
    }
  }

  // ── Step B: one record per student (two badges, one kid → one row) ───────
  const byStudent = new Map<string, Outcome>();
  for (const o of accepted) {
    if (o.decision !== 'ACCEPTED') continue;
    const cur = byStudent.get(o.studentId!);
    if (!cur || o.read!.readAt < cur.read!.readAt) {
      byStudent.set(o.studentId!, o);
    } else {
      o.decision = 'ALREADY_PRESENT';
    }
  }

  // Sort by (sessionId, studentId): concurrent batches lock rows in the same order → no deadlocks
  const toUpsert = [...byStudent.values()]
    .map((o) => {
      const sessionId = sessionIdBySection.get(o.classSectionId!);
      if (!sessionId) throw new Error('INGEST_INVARIANT: accepted outcome without session');
      return { o, sessionId };
    })
    .sort((a, b) => (a.sessionId + a.o.studentId!).localeCompare(b.sessionId + b.o.studentId!));

  // ── Step C: manual-safe upsert with insert/update detection ──────────────
  if (toUpsert.length) {
    const returned: Array<{ studentId: string; recordId: string; inserted: boolean }> = await tx
      .insert(attendanceRecords)
      .values(
        toUpsert.map(({ o, sessionId }) => ({
          schoolId: ctx.schoolId,
          attendanceSessionId: sessionId,
          studentId: o.studentId!,
          status: 'PRESENT',
          source: 'RFID',
          captureMethod: 'RFID_GATE',
          firstSeenAt: o.read!.readAt,
          firstScannedAt: o.read!.readAt,
          lastSeenAt: o.read!.readAt,
          lastUpdatedAt: new Date(),
          needsReview: Boolean(o.reviewFlag),
          reviewReason: o.reviewFlag ?? null,
        }))
      )
      .onConflictDoUpdate({
        target: [attendanceRecords.attendanceSessionId, attendanceRecords.studentId],
        set: {
          lastSeenAt: sql`GREATEST(${attendanceRecords.lastSeenAt}, excluded.last_seen_at)`,
          lastUpdatedAt: sql`now()`,
        },
        setWhere: sql`${attendanceRecords.source} <> 'MANUAL' AND ${attendanceRecords.captureMethod} <> 'MANUAL'`,
      })
      .returning({
        studentId: attendanceRecords.studentId,
        recordId: attendanceRecords.id,
        inserted: sql<boolean>`(xmax = 0)`,
      });

    const result = new Map(returned.map((r) => [r.studentId, r]));
    for (const { o } of toUpsert) {
      const r = result.get(o.studentId!);
      if (!r) {
        o.decision = 'MANUAL_OVERRIDE_PRESERVED'; // row exists, WHERE suppressed the update
      } else if (!r.inserted) {
        o.decision = 'ALREADY_PRESENT';
      }
    }

    // Audit trail for genuinely new presence
    const newRows = returned.filter((r) => r.inserted);
    if (newRows.length) {
      await tx.insert(attendanceEvents).values(
        newRows.map((r) => {
          const outcome = byStudent.get(r.studentId);
          const sectionId = outcome?.classSectionId;
          const sessionId = (sectionId && sessionIdBySection.get(sectionId)) || '';
          return {
            schoolId: ctx.schoolId,
            clientEventId: crypto.randomUUID(),
            attendanceSessionId: sessionId,
            studentId: r.studentId,
            eventType: 'RFID_PRESENT',
            statusValue: 'PRESENT',
            clientTimestamp: outcome?.read?.readAt || new Date(),
            serverReceivedAt: new Date(),
            actorType: 'READER' as const,
            actorId: null,
            actorReaderId: reader.id,
            captureMethod: 'RFID_GATE',
            sourceReaderId: reader.id,
          };
        })
      );
    }
  }

  // ── Step D: scan event log (everything except duplicates) ────────────────
  await writeScanEvents(tx, ctx, outcomes, reader);

  return outcomes;
}

export async function writeScanEvents(
  tx: Tx,
  ctx: IngestContext,
  outcomes: Outcome[],
  reader: { id: string }
): Promise<void> {
  const loggable = outcomes.filter((o) => o.read && !DUPLICATE_DECISIONS.has(o.decision));
  if (!loggable.length) return;
  const sessionIdBySection = new Map([...ctx.sessionBySection].map(([k, v]) => [k, v.id]));

  await tx
    .insert(rfidScanEvents)
    .values(
      loggable.map((o) => ({
        schoolId: ctx.schoolId,
        readerId: reader.id,
        credentialId: o.credentialId ?? null,
        studentId: o.studentId ?? null,
        attendanceSessionId: o.classSectionId ? sessionIdBySection.get(o.classSectionId) ?? null : null,
        clientEventId: o.read!.idempotencyKey,
        idempotencyKey: o.read!.idempotencyKey,
        epcDigest: o.read!.epcDigest,
        epcLastFour: o.read!.epcLast4,
        tidDigest: o.read!.tidDigest,
        antennaPort: o.read!.antenna,
        peakRssi: o.read!.rssi,
        scanTimestamp: o.read!.readAt,
        decision: o.decision,
        reviewFlag: o.reviewFlag ?? null,
        captureMethod: 'RFID_GATE' as const,
        securityMode: 'UHF_EPC' as const,
      }))
    )
    .onConflictDoNothing({ target: rfidScanEvents.idempotencyKey });
}
