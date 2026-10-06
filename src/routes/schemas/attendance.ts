import { z } from 'zod';

export const Uuid = z.string().uuid();

export const SessionStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'VERIFIED', 'FINALIZED']);
export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);
export const ScanSourceEnum = z.enum(['CAMERA', 'USB', 'MANUAL']);

export const CreateAttendanceSessionBody = z.object({
  classSectionId: Uuid,
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  sessionType: z.enum(['DAILY', 'SUBJECT']).default('DAILY'),
  teacherId: Uuid.optional(),
}).strict();

export const UpdateAttendanceSessionStatusBody = z.object({
  status: SessionStatusEnum.optional(),
  newStatus: SessionStatusEnum.optional(),
  reason: z.string().trim().max(500).optional(),
  autoMarkAbsentForUnmarked: z.boolean().optional(),
}).strict();

export const ProcessAttendanceScanBody = z.object({
  clientEventId: z.string().trim().min(1).max(255),
  rawToken: z.string().trim().max(2048).optional(),
  studentId: Uuid.optional(),
  statusValue: AttendanceStatusEnum.default('PRESENT'),
  clientTimestamp: z.string().datetime().optional(),
  deviceId: Uuid.optional(),
  source: ScanSourceEnum.default('CAMERA'),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const ManualAttendanceStatusBody = z.object({
  studentId: Uuid,
  status: AttendanceStatusEnum,
  notes: z.string().trim().max(500).optional(),
}).strict();

export const BulkManualAttendanceStatusBody = z.object({
  updates: z.array(ManualAttendanceStatusBody).min(1).max(500),
}).strict();
