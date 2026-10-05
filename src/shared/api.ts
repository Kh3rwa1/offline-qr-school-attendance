import { z } from 'zod';
import {
  CreateStudentBody,
  UpdateStudentDetailsBody,
  UpdateStudentStatusBody,
  ListStudentsQuery,
} from '../routes/schemas/students';
import {
  CreateAttendanceSessionBody,
  UpdateAttendanceSessionStatusBody,
  ProcessAttendanceScanBody,
  ManualAttendanceStatusBody,
  BulkManualAttendanceStatusBody,
} from '../routes/schemas/attendance';
import {
  IssueCredentialBody,
  UpdateCredentialStatusBody,
  RegisterReaderBody,
  UpdateReaderStatusBody,
} from '../routes/schemas/rfid';

export type ApiOk<T> = { success: true; data: T };
export type ApiErr = {
  success: false;
  error: string;
  message: string;
  requestId?: string;
  details?: Array<{ path: string; code: string }>;
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export {
  CreateStudentBody,
  UpdateStudentDetailsBody,
  UpdateStudentStatusBody,
  ListStudentsQuery,
  CreateAttendanceSessionBody,
  UpdateAttendanceSessionStatusBody,
  ProcessAttendanceScanBody,
  ManualAttendanceStatusBody,
  BulkManualAttendanceStatusBody,
  IssueCredentialBody,
  UpdateCredentialStatusBody,
  RegisterReaderBody,
  UpdateReaderStatusBody,
};

export type CreateStudentInput = z.infer<typeof CreateStudentBody>;
export type UpdateStudentDetailsInput = z.infer<typeof UpdateStudentDetailsBody>;
export type UpdateStudentStatusInput = z.infer<typeof UpdateStudentStatusBody>;
export type CreateAttendanceSessionInput = z.infer<typeof CreateAttendanceSessionBody>;
export type ProcessAttendanceScanInput = z.infer<typeof ProcessAttendanceScanBody>;
export type IssueCredentialInput = z.infer<typeof IssueCredentialBody>;
export type RegisterReaderInput = z.infer<typeof RegisterReaderBody>;
