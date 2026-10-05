import type { IngestContext, NormalizedRead, Outcome, Decision, ReviewFlag } from './types';

export function decideRead(read: NormalizedRead, ctx: IngestContext): Outcome {
  const base = { index: read.index, read };
  const reject = (decision: Decision, extra: Partial<Outcome> = {}): Outcome => ({ ...base, decision, ...extra });

  // 1. Time sanity (cheapest, no lookups)
  if (read.freshness === 'FUTURE_SKEW') return reject('FUTURE_SKEW');
  if (read.freshness === 'WRONG_SCHOOL_DAY') return reject('WRONG_SCHOOL_DAY');

  // 2. Recently accepted → duplicate (only accepted reads ever set this)
  if (ctx.debounced.has(read.epcDigest)) return reject('DUPLICATE_DEBOUNCED');

  // 3. Credential chain
  const cred = ctx.credsByDigest.get(read.epcDigest);
  if (!cred) return reject('UNREGISTERED_CARD');
  if (cred.status !== 'ACTIVE') return reject('SUSPENDED_CARD', { credentialId: cred.id });

  const student = ctx.studentsById.get(cred.studentId);
  if (!student) return reject('CREDENTIAL_ORPHANED', { credentialId: cred.id });
  const ids = { credentialId: cred.id, studentId: student.id };
  if (student.status !== 'ACTIVE') return reject('STUDENT_INACTIVE', ids);

  const enr = ctx.enrollmentByStudent.get(student.id);
  if (!enr) return reject('NOT_ENROLLED', ids);
  const withSection = { ...ids, classSectionId: enr.classSectionId };

  // 4. Day & session state
  if (!ctx.isSchoolDay) return reject('SCHOOL_CLOSED', withSection);

  const session = ctx.sessionBySection.get(enr.classSectionId);
  if (session?.status === 'FINALIZED') return reject('SESSION_FINALIZED', withSection);
  if (!session && !ctx.teacherBySection.has(enr.classSectionId)) return reject('NO_TEACHER_ASSIGNED', withSection);

  // 5. Accept (write stage may downgrade to ALREADY_PRESENT / MANUAL_OVERRIDE_PRESERVED)
  return {
    ...base,
    ...withSection,
    decision: 'ACCEPTED',
    needsSession: !session,
    reviewFlag: reviewFlagFor(read),
  };
}

function reviewFlagFor(read: NormalizedRead): ReviewFlag | undefined {
  if (read.freshness === 'LATE_BUFFERED') return 'LATE_BUFFERED';
  if (read.timeSource === 'SERVER') return 'SERVER_TIME';
  return undefined;
}

/** Compile-time guard: add a Decision, forget to handle it in the UI → type error. */
export function decisionLabelKey(d: Decision): string {
  switch (d) {
    case 'ACCEPTED':
      return 'rfid.decision.accepted';
    case 'ALREADY_PRESENT':
      return 'rfid.decision.alreadyPresent';
    case 'DUPLICATE_IN_BATCH':
    case 'DUPLICATE_DEBOUNCED':
      return 'rfid.decision.duplicate';
    case 'MALFORMED_READ':
      return 'rfid.decision.malformed';
    case 'FUTURE_SKEW':
    case 'WRONG_SCHOOL_DAY':
      return 'rfid.decision.clockIssue';
    case 'UNREGISTERED_CARD':
      return 'rfid.decision.unregistered';
    case 'SUSPENDED_CARD':
      return 'rfid.decision.suspended';
    case 'CREDENTIAL_ORPHANED':
      return 'rfid.decision.orphaned';
    case 'STUDENT_INACTIVE':
      return 'rfid.decision.studentInactive';
    case 'NOT_ENROLLED':
      return 'rfid.decision.notEnrolled';
    case 'SCHOOL_CLOSED':
      return 'rfid.decision.schoolClosed';
    case 'SESSION_FINALIZED':
      return 'rfid.decision.sessionFinalized';
    case 'NO_TEACHER_ASSIGNED':
      return 'rfid.decision.noTeacher';
    case 'MANUAL_OVERRIDE_PRESERVED':
      return 'rfid.decision.manualPreserved';
    default: {
      const _never: never = d;
      return _never;
    }
  }
}
