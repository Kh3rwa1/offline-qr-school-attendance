// scripts/pilot-report.ts
// Usage: tsx scripts/pilot-report.ts <schoolId> <fromDate> <toDate>
import { withSystemContext } from '../src/db';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';

const [schoolId, from, to] = process.argv.slice(2);
if (!schoolId || !from || !to) {
  console.error('Usage: tsx scripts/pilot-report.ts <schoolId> <fromDate> <toDate>');
  process.exit(1);
}

const TZ = 'Asia/Kolkata'; // Default school timezone

const rows = await withSystemContext((tx) =>
  tx.execute(sql`
    WITH truth AS (
      SELECT r.student_id, s.session_date AS d, r.status
        FROM attendance_records r
        JOIN attendance_sessions s ON s.id = r.attendance_session_id
       WHERE s.school_id = ${schoolId}::uuid AND s.session_date BETWEEN ${from}::date AND ${to}::date
         AND r.source = 'MANUAL'
    ),
    gate AS (
      SELECT DISTINCT e.student_id, (e.scan_timestamp AT TIME ZONE ${TZ})::date AS d
        FROM rfid_scan_events e
       WHERE e.school_id = ${schoolId}::uuid
         AND e.decision IN ('ACCEPTED','ALREADY_PRESENT','MANUAL_OVERRIDE_PRESERVED')
    )
    SELECT t.d,
           count(*) FILTER (WHERE t.status = 'PRESENT') AS present,
           count(*) FILTER (WHERE t.status = 'PRESENT' AND g.student_id IS NOT NULL) AS detected,
           count(*) FILTER (WHERE t.status = 'ABSENT' AND g.student_id IS NOT NULL) AS false_present
      FROM truth t LEFT JOIN gate g ON g.student_id = t.student_id AND g.d = t.d
     GROUP BY t.d ORDER BY t.d`)
);

const latency = await withSystemContext((tx) =>
  tx.execute(sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM created_at - scan_timestamp)) AS p50_s,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM created_at - scan_timestamp)) AS p95_s
      FROM rfid_scan_events
     WHERE school_id = ${schoolId}::uuid AND (scan_timestamp AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date`)
);

const decisions = await withSystemContext((tx) =>
  tx.execute(sql`
    SELECT decision, count(*) FROM rfid_scan_events
     WHERE school_id = ${schoolId}::uuid AND (scan_timestamp AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date
     GROUP BY decision ORDER BY count(*) DESC`)
);

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(2) : '—');
let present = 0;
let detected = 0;
let falsePresent = 0;

const lines = (rows.rows || []).map((r: any) => {
  present += +r.present;
  detected += +r.detected;
  falsePresent += +r.false_present;
  const dateStr = r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10);
  return `| ${dateStr} | ${r.present} | ${r.detected} | ${pct(+r.detected, +r.present)} % | ${r.false_present} |`;
});

const p50 = latency.rows?.[0]?.p50_s != null ? Number(latency.rows[0].p50_s).toFixed(1) : '—';
const p95 = latency.rows?.[0]?.p95_s != null ? Number(latency.rows[0].p95_s).toFixed(1) : '—';

const md = `# Pilot report: ${from} -> ${to}

**Read rate:** ${pct(detected, present)} % (${detected}/${present} truly-present student-days detected)
**False present:** ${falsePresent} student-days (badge detected, teacher marked absent)
**Gate->system latency:** p50 ${p50} s, p95 ${p95} s

| Date | Present (teacher) | Detected (RFID) | Read rate | False present |
|---|---|---|---|---|
${lines.join('\n')}

## Decisions
| Decision | Count |
|---|---|
${(decisions.rows || []).map((d: any) => `| ${d.decision} | ${d.count} |`).join('\n')}
`;

fs.mkdirSync('docs/evidence/pilots', { recursive: true });
fs.writeFileSync(`docs/evidence/pilots/${from}_${to}-report.md`, md);
console.log(md);
