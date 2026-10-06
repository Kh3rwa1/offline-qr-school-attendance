export const DECISIONS = [
  // accepted
  'ACCEPTED',
  'ALREADY_PRESENT',
  // duplicates (counted, not logged per-row)
  'DUPLICATE_IN_BATCH',
  'DUPLICATE_DEBOUNCED',
  // rejected
  'MALFORMED_READ',
  'FUTURE_SKEW',
  'WRONG_SCHOOL_DAY',
  'UNREGISTERED_CARD',
  'SUSPENDED_CARD',
  'CREDENTIAL_ORPHANED',
  'STUDENT_INACTIVE',
  'NOT_ENROLLED',
  'SCHOOL_CLOSED',
  'SESSION_FINALIZED',
  'NO_TEACHER_ASSIGNED',
  'NO_ACTIVE_SESSION',
  'MANUAL_OVERRIDE_PRESERVED',
] as const;

export type Decision = (typeof DECISIONS)[number];

export const ACCEPTED_DECISIONS = new Set<Decision>(['ACCEPTED', 'ALREADY_PRESENT']);
export const DUPLICATE_DECISIONS = new Set<Decision>(['DUPLICATE_IN_BATCH', 'DUPLICATE_DEBOUNCED']);

export type Freshness = 'OK' | 'MISSING_TIMESTAMP' | 'FUTURE_SKEW' | 'WRONG_SCHOOL_DAY' | 'LATE_BUFFERED';
export type ReviewFlag = 'LATE_BUFFERED' | 'SERVER_TIME';

export interface NormalizedRead {
  index: number;                 // position in the original payload
  epcDigest: string;
  epcLast4: string;
  tidDigest: string | null;
  antenna: number | null;
  rssi: number | null;
  readAt: Date;                  // reader time, or server time if missing
  timeSource: 'READER' | 'SERVER';
  freshness: Freshness;
  idempotencyKey: string;
}

export interface MalformedRead {
  index: number;
  reason: string;                // internal only, never echoed raw
}

export interface CredentialRow { id: string; studentId: string; epcDigest: string; status: string }
export interface StudentRow { id: string; name: string; status: string; photoUrl: string | null }
export interface EnrollmentRow { studentId: string; classSectionId: string; rollNumber: number | null }
export interface SessionRow { id: string; classSectionId: string; status: string }

export interface IngestContext {
  schoolId: string;
  schoolDate: string;            // YYYY-MM-DD in school timezone
  isSchoolDay: boolean;
  debounced: ReadonlySet<string>;                   // epcDigests seen recently
  credsByDigest: ReadonlyMap<string, CredentialRow>;
  studentsById: ReadonlyMap<string, StudentRow>;
  enrollmentByStudent: ReadonlyMap<string, EnrollmentRow>;
  sessionBySection: ReadonlyMap<string, SessionRow>;
  teacherBySection: ReadonlyMap<string, string>;    // classSectionId → teacher userId
}

export interface Outcome {
  index: number;
  decision: Decision;
  read?: NormalizedRead;
  studentId?: string;
  classSectionId?: string;
  credentialId?: string;
  needsSession?: boolean;
  reviewFlag?: ReviewFlag;
}
