import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import { createStudent } from '../src/services/studentService';
import { createQrCredential, revokeQrCredential } from '../src/services/qrService';
import { createAttendanceSession, updateSessionStatus } from '../src/services/attendanceService';
import { registerDevice, revokeDevice } from '../src/services/deviceService';
import { getOfflineRosterPackage, syncAttendanceEvents } from '../src/services/syncService';
import {
  computeSHA256,
  downloadAndStoreRosterPackage,
  createOfflineSession,
  processOfflineQRCode,
  syncOutboxEvents,
  getOutboxStatus,
} from '../src/services/offlineSyncService';
import { offlineDb } from '../src/db/offlineDb';
import { attendanceRecords, attendanceEvents, devices } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Milestone 4: Offline PWA & Idempotent Synchronization Engine', () => {
  let seeded: any;
  let studentA1: any;
  let studentA2: any;
  let studentB1: any;
  let qrA1: any;
  let qrA2: any;
  let qrB1: any;
  let testDevice: any;

  beforeEach(async () => {
    seeded = await seedDatabase();

    // Clear local Dexie tables before each test
    await offlineDb.rosters.clear();
    await offlineDb.sessions.clear();
    await offlineDb.sessionRosters.clear();
    await offlineDb.syncOutbox.clear();

    const uid1 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid2 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid3 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Create Student 1 in School A, Class 5A
    const resA1 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-OFF-1-${uid1}`,
      name: 'Anirban Das',
      nameBn: 'অনির্বাণ দাস',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 10,
    });
    studentA1 = resA1.student;

    // Create Student 2 in School A, Class 5A
    const resA2 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-OFF-2-${uid2}`,
      name: 'Mousumi Chatterjee',
      nameBn: 'মৌসুমি চট্টোপাধ্যায়',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 11,
    });
    studentA2 = resA2.student;

    // Create Student 3 in School B, Class 6A
    const resB1 = await createStudent({
      schoolId: seeded.schoolB.id,
      studentCode: `STU-OFF-3-${uid3}`,
      name: 'Debjani Paul',
      nameBn: 'দেবজানী পাল',
      classSectionId: seeded.schoolBClass6A.id,
      academicYearId: seeded.academicYearB.id,
      rollNumber: 12,
    });
    studentB1 = resB1.student;

    // Create active QR credentials
    qrA1 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA1.id });
    qrA2 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA2.id });
    qrB1 = await createQrCredential(db, { schoolId: seeded.schoolB.id, studentId: studentB1.id });

    // Register a test phone device for Teacher User
    testDevice = await registerDevice({
      schoolId: seeded.schoolA.id,
      userId: seeded.teacherUser.id,
      deviceIdentifier: `DEV-OFFLINE-${Math.random().toString(36).substring(2, 8)}`,
      deviceModel: 'Samsung Galaxy A14',
    });
  });

  it('downloads offline roster package containing active QR SHA-256 digests', async () => {
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);

    expect(pkg.schoolId).toBe(seeded.schoolA.id);
    expect(pkg.classSectionId).toBe(seeded.schoolAClass5A.id);
    expect(pkg.students.length).toBeGreaterThanOrEqual(2);

    const s1Pkg = pkg.students.find((s) => s.studentId === studentA1.id);
    expect(s1Pkg).toBeDefined();
    expect(s1Pkg?.name).toBe('Anirban Das');
    expect(s1Pkg?.sha256TokenHash).toBe(qrA1.credential.tokenDigest);
    expect(s1Pkg?.isRevoked).toBe(false);
  });

  it('computes local SHA-256 token hash matching server digest', async () => {
    const localHash = await computeSHA256(qrA1.rawToken);
    expect(localHash).toBe(qrA1.credential.tokenDigest);
  });

  it('creates offline attendance session and initializes local Dexie roster snapshot', async () => {
    // Populate Dexie rosters table first
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);
    await offlineDb.rosters.bulkPut(
      pkg.students.map((s) => ({
        studentId: s.studentId,
        schoolId: seeded.schoolA.id,
        classSectionId: seeded.schoolAClass5A.id,
        studentCode: s.studentCode,
        banglarShikshaId: s.banglarShikshaId,
        name: s.name,
        nameBn: s.nameBn,
        rollNumber: s.rollNumber,
        photoUrl: s.photoUrl,
        sha256TokenHash: s.sha256TokenHash,
        isRevoked: s.isRevoked,
      }))
    );

    const offlineSession = await createOfflineSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
    });

    expect(offlineSession.id).toBeDefined();
    expect(offlineSession.status).toBe('OPEN');

    const sessionRosters = await offlineDb.sessionRosters
      .where('sessionId')
      .equals(offlineSession.id)
      .toArray();

    expect(sessionRosters.length).toBeGreaterThanOrEqual(2);
    expect(sessionRosters.every((r) => r.status === 'UNMARKED')).toBe(true);
  });

  it('processes offline QR scan, matches student, and queues event in Dexie Outbox', async () => {
    // Populate Dexie rosters
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);
    await offlineDb.rosters.bulkPut(
      pkg.students.map((s) => ({
        studentId: s.studentId,
        schoolId: seeded.schoolA.id,
        classSectionId: seeded.schoolAClass5A.id,
        studentCode: s.studentCode,
        name: s.name,
        nameBn: s.nameBn,
        rollNumber: s.rollNumber,
        sha256TokenHash: s.sha256TokenHash,
        isRevoked: s.isRevoked,
      }))
    );

    const session = await createOfflineSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
    });

    const scanRes = await processOfflineQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      rawToken: qrA1.rawToken,
      actorId: seeded.teacherUser.id,
      source: 'CAMERA',
    });

    expect(scanRes.success).toBe(true);
    expect(scanRes.duplicateScan).toBe(false);
    expect(scanRes.student.name).toBe('Anirban Das');

    // Verify item saved in Dexie syncOutbox
    const outboxItems = await offlineDb.syncOutbox.toArray();
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0].studentId).toBe(studentA1.id);
    expect(outboxItems[0].syncStatus).toBe('PENDING');

    const statusInfo = await getOutboxStatus();
    expect(statusInfo.pendingCount).toBe(1);
    expect(statusInfo.unsyncedTotal).toBe(1);
  });

  it('suppresses duplicate scan and returns warning alert locally', async () => {
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);
    await offlineDb.rosters.bulkPut(
      pkg.students.map((s) => ({
        studentId: s.studentId,
        schoolId: seeded.schoolA.id,
        classSectionId: seeded.schoolAClass5A.id,
        studentCode: s.studentCode,
        name: s.name,
        rollNumber: s.rollNumber,
        sha256TokenHash: s.sha256TokenHash,
        isRevoked: s.isRevoked,
      }))
    );

    const session = await createOfflineSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
    });

    // First scan
    await processOfflineQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      rawToken: qrA1.rawToken,
      actorId: seeded.teacherUser.id,
    });

    // Duplicate scan
    const dupRes = await processOfflineQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      rawToken: qrA1.rawToken,
      actorId: seeded.teacherUser.id,
    });

    expect(dupRes.success).toBe(true);
    expect(dupRes.duplicateScan).toBe(true);
    expect(dupRes.message).toContain('already marked PRESENT');

    // Outbox should still only contain 1 item
    const outboxItems = await offlineDb.syncOutbox.toArray();
    expect(outboxItems.length).toBe(1);
  });

  it('rejects wrong-school QR code scan locally', async () => {
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);
    await offlineDb.rosters.bulkPut(
      pkg.students.map((s) => ({
        studentId: s.studentId,
        schoolId: seeded.schoolA.id,
        classSectionId: seeded.schoolAClass5A.id,
        studentCode: s.studentCode,
        name: s.name,
        rollNumber: s.rollNumber,
        sha256TokenHash: s.sha256TokenHash,
        isRevoked: s.isRevoked,
      }))
    );

    // Add School B student to local store with schoolId = School B
    const tokenHashB = await computeSHA256(qrB1.rawToken);
    await offlineDb.rosters.put({
      studentId: studentB1.id,
      schoolId: seeded.schoolB.id,
      classSectionId: seeded.schoolBClass6A.id,
      studentCode: 'STU-B',
      name: 'Arijit',
      rollNumber: 1,
      sha256TokenHash: tokenHashB,
      isRevoked: false,
    });

    const session = await createOfflineSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
    });

    const res = await processOfflineQRCode({
      schoolId: seeded.schoolA.id, // School A session
      sessionId: session.id,
      rawToken: qrB1.rawToken, // School B token
      actorId: seeded.teacherUser.id,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('WRONG_SCHOOL_QR');
  });

  it('rejects revoked QR code scan locally', async () => {
    const pkg = await getOfflineRosterPackage(seeded.schoolA.id, seeded.schoolAClass5A.id);
    const s1Pkg = pkg.students.find((s) => s.studentId === studentA1.id);

    await offlineDb.rosters.put({
      studentId: studentA1.id,
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      studentCode: studentA1.studentCode,
      name: studentA1.name,
      rollNumber: 10,
      sha256TokenHash: s1Pkg?.sha256TokenHash,
      isRevoked: true, // Marked revoked
    });

    const session = await createOfflineSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
    });

    const res = await processOfflineQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      rawToken: qrA1.rawToken,
      actorId: seeded.teacherUser.id,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('REVOKED_QR_TOKEN');
  });

  it('batch sync re-transmission safety: 1st batch ACCEPTED, 2nd batch ALREADY_PROCESSED', async () => {
    // Create an online session first on the server
    const serverSession = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    const clientEvent1 = `evt-batch-001-${Math.random()}`;
    const clientEvent2 = `evt-batch-002-${Math.random()}`;

    const batchPayload = {
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      deviceIdentifier: testDevice.deviceIdentifier,
      events: [
        {
          clientEventId: clientEvent1,
          sessionId: serverSession.session.id,
          studentId: studentA1.id,
          rawToken: qrA1.rawToken,
          statusValue: 'PRESENT' as const,
          clientTimestamp: new Date().toISOString(),
          source: 'CAMERA' as const,
        },
        {
          clientEventId: clientEvent2,
          sessionId: serverSession.session.id,
          studentId: studentA2.id,
          rawToken: qrA2.rawToken,
          statusValue: 'PRESENT' as const,
          clientTimestamp: new Date().toISOString(),
          source: 'CAMERA' as const,
        },
      ],
    };

    // 1st transmission
    const res1 = await syncAttendanceEvents(batchPayload);

    expect(res1.processedCount).toBe(2);
    expect(res1.results.every((r) => r.status === 'ACCEPTED')).toBe(true);

    // Verify 2 records created in database
    const dbRecords = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.attendanceSessionId, serverSession.session.id));
    expect(dbRecords.length).toBe(2);

    // 2nd transmission of identical batch
    const res2 = await syncAttendanceEvents(batchPayload);

    expect(res2.processedCount).toBe(2);
    expect(res2.results.every((r) => r.status === 'ALREADY_PROCESSED')).toBe(true);

    // Verify database still contains exactly 2 records (zero duplicate insertions)
    const dbRecordsPostSync2 = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.attendanceSessionId, serverSession.session.id));
    expect(dbRecordsPostSync2.length).toBe(2);
  });

  it('rejects batch sync when device is revoked (DEVICE_REVOKED / HTTP 403)', async () => {
    const serverSession = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Revoke the test device
    await revokeDevice(seeded.schoolA.id, testDevice.id, seeded.schoolAdminUser.id);

    const batchPayload = {
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      deviceIdentifier: testDevice.deviceIdentifier,
      events: [
        {
          clientEventId: `evt-rev-dev-${Math.random()}`,
          sessionId: serverSession.session.id,
          studentId: studentA1.id,
          rawToken: qrA1.rawToken,
          clientTimestamp: new Date().toISOString(),
        },
      ],
    };

    await expect(syncAttendanceEvents(batchPayload)).rejects.toThrow('DEVICE_REVOKED');
  });

  it('preserves concurrent conflict when sync arrives for finalized session', async () => {
    const serverSession = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-11',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Teacher B / Admin finalizes session online
    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: serverSession.session.id,
      actorId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
      newStatus: 'FINALIZED',
      autoMarkAbsentForUnmarked: true,
    });

    // Offline sync from Teacher A arrives later
    const syncRes = await syncAttendanceEvents({
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      events: [
        {
          clientEventId: `evt-conflict-${Math.random()}`,
          sessionId: serverSession.session.id,
          studentId: studentA1.id,
          rawToken: qrA1.rawToken,
          statusValue: 'PRESENT',
          clientTimestamp: new Date().toISOString(),
        },
      ],
    });

    expect(syncRes.results[0].status).toBe('REJECTED');
    expect(syncRes.results[0].error).toBe('FINALIZED_SESSION_LOCKED');

    // Verify studentA1 record has conflict flag set in DB
    const [record] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.attendanceSessionId, serverSession.session.id),
          eq(attendanceRecords.studentId, studentA1.id)
        )
      );

    expect(record).toBeDefined();
    expect(record.hasConflict).toBe(true);
  });
});
