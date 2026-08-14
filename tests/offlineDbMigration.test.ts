import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { AttendanceOfflineDatabase } from '../src/db/offlineDb';

describe('Dexie IndexedDB v4 Schema & Data Migration Suite', () => {
  it('1. Successfully opens database at version 4 with all compound indexes', async () => {
    const db = new AttendanceOfflineDatabase();
    await db.open();

    expect(db.verno).toBe(4);
    expect(db.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['rosters', 'sessions', 'sessionRosters', 'syncOutbox'])
    );

    db.close();
  });

  it('2. Preserves existing roster and session data across schema version 4 upgrade', async () => {
    const db = new AttendanceOfflineDatabase();
    await db.open();

    const testSchoolId = '00000000-0000-0000-0000-000000000001';
    const testClassId = '00000000-0000-0000-0000-000000000002';
    const testSessionId = 'session-upgrade-test-01';

    // Seed test records
    await db.rosters.put({
      studentId: 'student-01',
      schoolId: testSchoolId,
      classSectionId: testClassId,
      studentCode: 'STU-001',
      name: 'Rohan Sharma',
      rollNumber: 1,
    });

    await db.sessions.put({
      id: testSessionId,
      clientSessionId: testSessionId,
      schoolId: testSchoolId,
      classSectionId: testClassId,
      sessionDate: '2026-08-14',
      sessionType: 'DAILY',
      status: 'OPEN',
      teacherId: 'teacher-01',
      isOfflineCreated: true,
    });

    await db.sessionRosters.put({
      id: 1,
      sessionId: testSessionId,
      studentId: 'student-01',
      studentCode: 'STU-001',
      rollNumber: 1,
      studentName: 'Rohan Sharma',
      status: 'PRESENT',
      firstScannedAt: new Date().toISOString(),
    });

    await db.syncOutbox.put({
      clientEventId: 'evt-001',
      schoolId: testSchoolId,
      sessionId: testSessionId,
      sessionMetadata: {
        clientSessionId: testSessionId,
        classSectionId: testClassId,
        sessionDate: '2026-08-14',
        sessionType: 'DAILY',
      },
      studentId: 'student-01',
      eventType: 'ATTENDANCE_RECORDED',
      statusValue: 'PRESENT',
      clientTimestamp: new Date().toISOString(),
      source: 'CAMERA',
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    // Verify compound queries work on new index [classSectionId+sessionDate]
    const foundSession = await db.sessions
      .where('[classSectionId+sessionDate]')
      .equals([testClassId, '2026-08-14'])
      .first();

    expect(foundSession).toBeDefined();
    expect(foundSession?.id).toBe(testSessionId);

    // Verify roster query
    const foundRoster = await db.rosters.where('classSectionId').equals(testClassId).toArray();
    expect(foundRoster.length).toBe(1);
    expect(foundRoster[0].name).toBe('Rohan Sharma');

    // Verify outbox query
    const pendingEvents = await db.syncOutbox.where('syncStatus').equals('PENDING').toArray();
    expect(pendingEvents.length).toBe(1);
    expect(pendingEvents[0].clientEventId).toBe('evt-001');

    db.close();
  });
});
