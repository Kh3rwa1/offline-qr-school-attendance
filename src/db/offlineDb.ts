import Dexie, { Table } from 'dexie';

export interface OfflineRosterItem {
  studentId: string;
  schoolId: string;
  classSectionId: string;
  studentCode: string;
  banglarShikshaId?: string | null;
  name: string;
  nameBn?: string | null;
  rollNumber: number;
  photoUrl?: string | null;
  sha256TokenHash?: string | null;
  isRevoked?: boolean;
}

export interface OfflineSessionItem {
  id: string;
  clientSessionId: string;
  serverSessionId?: string;
  schoolId: string;
  classSectionId: string;
  sessionDate: string;
  sessionType: string;
  status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'FINALIZED' | 'REOPENED';
  teacherId: string;
  isOfflineCreated?: boolean;
}

export interface OfflineSessionRosterItem {
  id?: number;
  sessionId: string;
  studentId: string;
  studentCode: string;
  rollNumber: number;
  studentName: string;
  studentNameBn?: string | null;
  photoUrl?: string | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE' | 'UNMARKED';
  firstScannedAt?: string | null;
}

export interface OutboxEventItem {
  clientEventId: string;
  schoolId: string;
  sessionId: string;
  sessionMetadata: {
    clientSessionId: string;
    classSectionId: string;
    sessionDate: string;
    sessionType: string;
  };
  studentId?: string;
  eventType: string;
  statusValue: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE';
  rawToken?: string;
  clientTimestamp: string;
  source: 'CAMERA' | 'USB' | 'MANUAL';
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  syncError?: string;
  retryCount: number;
  createdAt: string;
}

export class AttendanceOfflineDatabase extends Dexie {
  rosters!: Table<OfflineRosterItem, string>;
  sessions!: Table<OfflineSessionItem, string>;
  sessionRosters!: Table<OfflineSessionRosterItem, number>;
  syncOutbox!: Table<OutboxEventItem, string>;

  constructor() {
    super('SchoolAttendanceOfflineDB');
    this.version(1).stores({
      rosters: 'studentId, [schoolId+classSectionId], sha256TokenHash, schoolId, classSectionId',
      sessions: 'id, [schoolId+classSectionId], sessionDate, status',
      sessionRosters: '++id, [sessionId+studentId], sessionId, studentId, status',
      syncOutbox: 'clientEventId, [schoolId+sessionId], syncStatus, clientTimestamp',
    });
    this.version(2).stores({
      rosters: 'studentId, [schoolId+classSectionId], sha256TokenHash, schoolId, classSectionId',
      sessions: 'id, clientSessionId, [schoolId+classSectionId], sessionDate, status',
      sessionRosters: '++id, [sessionId+studentId], sessionId, studentId, status',
      syncOutbox: 'clientEventId, [schoolId+sessionId], syncStatus, clientTimestamp',
    }).upgrade((tx) => tx.table('sessions').toCollection().modify((session: OfflineSessionItem) => {
      session.clientSessionId = session.clientSessionId || session.id;
    }));
  }
}

export const offlineDb = new AttendanceOfflineDatabase();
