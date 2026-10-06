import { sql } from 'drizzle-orm';
import type { Tx } from '../../db';

export type AnomalyKind = 'GATE_PRESENT_CLASS_ABSENT' | 'MULTI_READER_BURST' | 'OFF_HOURS_READ';

export interface AnomalyRecord {
  studentId: string;
  kind: AnomalyKind;
  at: Date | string;
}

const anomalyMetrics = new Map<AnomalyKind, number>();

export function recordAnomalyMetric(kind: AnomalyKind, count = 1) {
  const cur = anomalyMetrics.get(kind) ?? 0;
  anomalyMetrics.set(kind, cur + count);
}

export function renderAnomalyMetrics(): string[] {
  const lines: string[] = [];
  lines.push('# HELP attendease_rfid_anomalies_total RFID anomaly events detected');
  lines.push('# TYPE attendease_rfid_anomalies_total counter');
  for (const [kind, count] of anomalyMetrics.entries()) {
    lines.push(`attendease_rfid_anomalies_total{kind="${kind}"} ${count}`);
  }
  return lines;
}

export async function findAnomalies(tx: Tx, schoolId: string, date: string, tz: string): Promise<AnomalyRecord[]> {
  // 1. Badge went through the gate, but the teacher says the child isn't in class
  const gateNotClass = await tx.execute(sql`
    SELECT DISTINCT e.student_id, 'GATE_PRESENT_CLASS_ABSENT' AS kind, min(e.scan_timestamp) AS at
      FROM rfid_scan_events e
      JOIN attendance_records r ON r.student_id = e.student_id
      JOIN attendance_sessions s ON s.id = r.attendance_session_id AND s.session_date = ${date}::date
     WHERE e.school_id = ${schoolId}::uuid
       AND e.decision IN ('ACCEPTED','ALREADY_PRESENT','MANUAL_OVERRIDE_PRESERVED')
       AND (e.scan_timestamp AT TIME ZONE ${tz})::date = ${date}::date
       AND r.status = 'ABSENT' AND r.source = 'MANUAL'
     GROUP BY e.student_id`);

  // 2. Multi-reader burst: same credential read by different readers within 60 seconds
  const bursts = await tx.execute(sql`
    SELECT a.student_id, 'MULTI_READER_BURST' AS kind, min(a.scan_timestamp) AS at
      FROM rfid_scan_events a
      JOIN rfid_scan_events b ON a.credential_id = b.credential_id
                             AND a.reader_id != b.reader_id
                             AND abs(extract(epoch FROM a.scan_timestamp - b.scan_timestamp)) < 60
     WHERE a.school_id = ${schoolId}::uuid
       AND (a.scan_timestamp AT TIME ZONE ${tz})::date = ${date}::date
     GROUP BY a.student_id`);

  // 3. Off-hours read: scans outside 06:00 - 18:00
  const offHours = await tx.execute(sql`
    SELECT DISTINCT e.student_id, 'OFF_HOURS_READ' AS kind, min(e.scan_timestamp) AS at
      FROM rfid_scan_events e
     WHERE e.school_id = ${schoolId}::uuid
       AND (e.scan_timestamp AT TIME ZONE ${tz})::date = ${date}::date
       AND (extract(hour FROM e.scan_timestamp AT TIME ZONE ${tz}) < 6
         OR extract(hour FROM e.scan_timestamp AT TIME ZONE ${tz}) >= 18)
     GROUP BY e.student_id`);

  interface RawAnomalyRow {
    student_id: string;
    kind: AnomalyKind;
    at: Date | string;
  }

  const results: AnomalyRecord[] = [
    ...((gateNotClass.rows || []) as unknown as RawAnomalyRow[]),
    ...((bursts.rows || []) as unknown as RawAnomalyRow[]),
    ...((offHours.rows || []) as unknown as RawAnomalyRow[]),
  ].map((r) => ({
    studentId: r.student_id,
    kind: r.kind,
    at: r.at,
  }));

  for (const item of results) {
    recordAnomalyMetric(item.kind);
  }

  return results;
}
