export type Language = 'en' | 'bn' | 'hi';

export type NetworkStatus = 'ONLINE' | 'OFFLINE';

export type AttendanceStatus = 'UNMARKED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE';

export interface Student {
  id: string;
  studentCode: string;
  banglarShikshaId?: string;
  name: string;
  nameBn: string;
  rollNumber: number;
  className: string;
  section: string;
  photoUrl?: string;
  qrDigest: string;
  status: AttendanceStatus;
  scannedAt?: string;
}

export interface AttendanceEvent {
  clientEventId: string;
  sessionId: string;
  studentId: string;
  eventType: 'QR_SCANNED' | 'MANUALLY_PRESENT' | 'MARKED_ABSENT';
  statusValue: AttendanceStatus;
  clientTimestamp: string;
  syncStatus: 'PENDING' | 'ACCEPTED' | 'ALREADY_PROCESSED';
}

export interface ClassSession {
  id: string;
  schoolId?: string;
  className: string;
  section: string;
  teacherName: string;
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'FINALIZED';
}
