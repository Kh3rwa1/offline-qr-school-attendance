// scripts/gen-decisions-doc.ts
import fs from 'node:fs';
import path from 'node:path';
import {
  DECISIONS,
  ACCEPTED_DECISIONS,
  DUPLICATE_DECISIONS,
  type Decision,
} from '../src/services/rfid/ingest/types';

interface DecisionDetails {
  category: 'Accepted' | 'Debounced Duplicate' | 'Rejected';
  outcome: string;
  cause: string;
  action: string;
}

const DECISION_METADATA: Record<Decision, DecisionDetails> = {
  ACCEPTED: {
    category: 'Accepted',
    outcome: 'Recorded as PRESENT in section daily attendance session.',
    cause: 'Valid badge, student actively enrolled, session open and within school hours.',
    action: 'None required. Student arrival recorded on live dashboard.',
  },
  ALREADY_PRESENT: {
    category: 'Accepted',
    outcome: 'Ignored as redundant (student already marked present today).',
    cause: 'Student tapped again after earlier accepted entry.',
    action: 'None required. Prior arrival status maintained.',
  },
  DUPLICATE_IN_BATCH: {
    category: 'Debounced Duplicate',
    outcome: 'Deduplicated in memory; counted in batch statistics, not logged per-row.',
    cause: 'UHF tag bounced multiple times in a single reader transmission window.',
    action: 'None required. UHF tags naturally produce multiple reads in dwell area.',
  },
  DUPLICATE_DEBOUNCED: {
    category: 'Debounced Duplicate',
    outcome: 'Filtered by Redis cache; counted in statistics, not logged per-row.',
    cause: 'Tag read within 30-second cooldown window following accepted tap.',
    action: 'None required. Prevents gate loitering from creating duplicate logs.',
  },
  MALFORMED_READ: {
    category: 'Rejected',
    outcome: 'Rejected with 400 or skipped in batch error collection.',
    cause: 'Missing valid EPC hexadecimal string or unexpected JSON schema.',
    action: 'Inspect reader antenna cabling, RF power levels, or tag physical damage.',
  },
  FUTURE_SKEW: {
    category: 'Rejected',
    outcome: 'Rejected without updating attendance.',
    cause: 'Reader hardware timestamp is >30 seconds ahead of appliance clock.',
    action: 'Verify reader NTP client configuration and synchronize appliance clock.',
  },
  WRONG_SCHOOL_DAY: {
    category: 'Rejected',
    outcome: 'Rejected without updating attendance.',
    cause: 'Read timestamp does not fall on the active calendar date in school timezone.',
    action: 'Verify reader timezone configuration (`Asia/Kolkata` default) and calendar settings.',
  },
  UNREGISTERED_CARD: {
    category: 'Rejected',
    outcome: 'Rejected and logged to security audit trail.',
    cause: 'EPC digest does not match any enrolled credential in the school database.',
    action: 'Verify badge assignment in Admin > Badges. If lost or new, issue badge to student.',
  },
  SUSPENDED_CARD: {
    category: 'Rejected',
    outcome: 'Rejected; student remains unmarked.',
    cause: 'Credential status is set to SUSPENDED, REVOKED, or LOST.',
    action: 'Send student to school office to resolve suspension or replace lost badge.',
  },
  CREDENTIAL_ORPHANED: {
    category: 'Rejected',
    outcome: 'Rejected; system alert logged.',
    cause: 'Credential row exists but associated student record was deleted.',
    action: 'Administrator must re-assign or delete orphaned credential in Admin > Badges.',
  },
  STUDENT_INACTIVE: {
    category: 'Rejected',
    outcome: 'Rejected; attendance not credited.',
    cause: 'Linked student status is INACTIVE or TRANSFERRED.',
    action: 'School administrator should review enrollment records with principal/registrar.',
  },
  NOT_ENROLLED: {
    category: 'Rejected',
    outcome: 'Rejected; attendance not credited.',
    cause: 'Student is active but has no enrollment in an active section for this academic year.',
    action: 'Enroll student into their designated grade and class section.',
  },
  SCHOOL_CLOSED: {
    category: 'Rejected',
    outcome: 'Rejected; attendance sessions not opened.',
    cause: 'School calendar designates today as weekend, holiday, or emergency closure.',
    action: 'Verify academic calendar holiday dates if school is operating on a special day.',
  },
  SESSION_FINALIZED: {
    category: 'Rejected',
    outcome: 'Rejected; finalized attendance is immutable to automated gate taps.',
    cause: 'Classroom teacher already finalized the session (absentees locked & SMS sent).',
    action: 'Teacher must apply a Manual Override in Teacher Dashboard if admitting late arrival.',
  },
  NO_TEACHER_ASSIGNED: {
    category: 'Rejected',
    outcome: 'Rejected; auto-session creation requires assigned teacher context.',
    cause: 'Student section has no primary teacher assigned in the timetable.',
    action: 'Assign a designated teacher to the class section in Admin > Classes.',
  },
  MANUAL_OVERRIDE_PRESERVED: {
    category: 'Rejected',
    outcome: 'Rejected; teacher manual status preserved.',
    cause: 'Teacher previously marked student EXCUSED or ABSENT with manual priority.',
    action: 'None required. Teacher manual discretion always overrides automated gate reads.',
  },
};

export function generateDecisionsDoc(projectRoot: string = process.cwd()): void {
  const today = '2026-10-06';
  const outPath = path.resolve(projectRoot, 'docs/reference/decisions.md');

  const lines: string[] = [
    '---',
    'title: "Ingest Decision Reference"',
    'owner: "@Kh3rwa1"',
    'applies_to: ">=2.0.0"',
    `last_verified: ${today}`,
    '---',
    '',
    '# Ingest Decision Reference',
    '',
    'Dictionary of all possible decision outcomes emitted by the AttendEase OS Zebra FX9600 gate ingest pipeline (`src/services/rfid/ingest/decide.ts`).',
    '',
    '## Decision Matrix',
    '',
    '| Decision Code | Category | Outcome | Meaning & Root Cause | Teacher / Admin Action |',
    '|---|---|---|---|---|',
  ];

  for (const decision of DECISIONS) {
    const meta = DECISION_METADATA[decision];
    lines.push(
      `| \`${decision}\` | **${meta.category}** | ${meta.outcome} | ${meta.cause} | ${meta.action} |`
    );
  }

  lines.push(
    '',
    '## Ingest Categories',
    '',
    `- **Accepted (${ACCEPTED_DECISIONS.size} codes)**: Tag validated; updates student arrival state or notes existing presence.`,
    `- **Debounced Duplicates (${DUPLICATE_DECISIONS.size} codes)**: High-frequency UHF RFID bounces suppressed by in-memory deduplication and Redis cooldown cache to protect database write capacity.`,
    `- **Rejected (${DECISIONS.length - ACCEPTED_DECISIONS.size - DUPLICATE_DECISIONS.size} codes)**: Reads failing cryptographic, temporal, enrollment, or operational boundary checks. Logged with failure diagnostic for review.`,
    ''
  );

  fs.writeFileSync(outPath, lines.join('\n'));
}

if (process.argv[1]?.endsWith('gen-decisions-doc.ts')) {
  generateDecisionsDoc();
  console.log('Generated docs/reference/decisions.md');
}
