import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index';
import {
  attendanceSessions,
  attendanceEvents,
  attendanceRecords,
  teacherAssignments,
  students,
  devices,
} from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { seedDatabase } from '../src/db/seed';
import { createStudent } from '../src/services/studentService';
import { createAttendanceSession, processQRCode, updateSessionStatus } from '../src/services/attendanceService';
import { syncAttendanceEvents } from '../src/services/syncService';
import { createQrCredential } from '../src/services/qrService';

describe('Phase 1 — Attendance Authorization & Idempotency Hardening Tests', () => {
  let seeded: any;
  let studentA1: any;
  let qrA1: any;
  let deviceA1: any;

  beforeEach(async () => {
    seeded = await seedDatabase();
    const uid = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    studentA1 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-P1-${uid}`,
      name: 'Test Student Phase1',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 1,
    });
    qrA1 = await createQrCredential(db, {
      schoolId: seeded.schoolA.id,
      studentId: studentA1.student.id,
    });

    [deviceA1] = await db
      .insert(devices)
      .values({
        schoolId: seeded.schoolA.id,
        userId: seeded.teacherUser.id,
        deviceIdentifier: `DEV-P1-${Date.now()}-${Math.random()}`,
        deviceName: 'Test Tablet',
        deviceType: 'TABLET',
        status: 'APPROVED',
      })
      .returning();
  });

  it('allows assigned teacher to scan online and sync offline', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-01',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    const scanRes = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      clientEventId: `evt-phase1-online-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    expect(scanRes.success).toBe(true);
    expect(scanRes.record.status).toBe('PRESENT');

    // Offline sync by assigned teacher
    const syncRes = await syncAttendanceEvents({
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      deviceIdentifier: deviceA1.deviceIdentifier,
      events: [
        {
          clientEventId: `evt-phase1-sync-${Math.random()}`,
          sessionId: sessionRes.session.id,
          studentId: studentA1.student.id,
          rawToken: qrA1.rawToken,
          clientTimestamp: new Date().toISOString(),
          statusValue: 'PRESENT',
        },
      ],
    });

    expect(syncRes.results[0].status).toBe('ACCEPTED');
  });

  it('fails closed when actorId or userRole is missing in processQRCode', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-02',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: '',
        userRole: 'TEACHER',
        clientEventId: 'evt-missing-actor',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('UNAUTHORIZED_ACTOR_CONTEXT');

    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        userRole: '' as any,
        clientEventId: 'evt-missing-role',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('UNAUTHORIZED_ACTOR_CONTEXT');
  });

  it('rejects unassigned teacher scanning online or synchronizing existing session', async () => {
    // Session in School A Class 6A (teacherUser is assigned to Class 5A, but NOT Class 6A)
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass6A.id, // Class 6A!
      teacherId: seeded.schoolAdminUser.id,
      sessionDate: '2026-09-03',
      actorId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
    });

    // Unassigned teacherUser tries scanning online in Class 6A session
    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id, // NOT assigned to Class 6A
        userRole: 'TEACHER',
        clientEventId: 'evt-unassigned-online',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');

    // Unassigned teacherUser sends sync event for existing session
    const syncRes = await syncAttendanceEvents({
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      deviceIdentifier: deviceA1.deviceIdentifier,
      events: [
        {
          clientEventId: 'evt-unassigned-sync',
          sessionId: sessionRes.session.id,
          studentId: studentA1.student.id,
          rawToken: qrA1.rawToken,
          clientTimestamp: new Date().toISOString(),
        },
      ],
    });

    expect(syncRes.results[0].status).toBe('REJECTED');
    expect(syncRes.results[0].error).toBe('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
  });

  it('allows SCHOOL_ADMIN and SUPER_ADMIN full scan and sync access without explicit teacher assignment', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.schoolAdminUser.id,
      sessionDate: '2026-09-04',
      actorId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
    });

    const adminScan = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
      clientEventId: `evt-admin-scan-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    expect(adminScan.success).toBe(true);

    const superSync = await syncAttendanceEvents({
      schoolId: seeded.schoolA.id,
      actorId: seeded.superAdminUser.id,
      userRole: 'SUPER_ADMIN',
      deviceIdentifier: deviceA1.deviceIdentifier,
      events: [
        {
          clientEventId: `evt-super-sync-${Math.random()}`,
          sessionId: sessionRes.session.id,
          studentId: studentA1.student.id,
          rawToken: qrA1.rawToken,
          clientTimestamp: new Date().toISOString(),
        },
      ],
    });

    expect(superSync.results[0].status).toBe('ACCEPTED');
  });

  it('prevents cross-tenant scan or sync attempts', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-05',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Attempt scan in School B using School A credentials
    await expect(
      processQRCode({
        schoolId: seeded.schoolB.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        userRole: 'TEACHER',
        clientEventId: 'evt-cross-tenant-01',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('SESSION_NOT_FOUND');
  });

  it('does not return an event from session A when another session is queried', async () => {
    const sessA = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-06',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    const sessB = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-07',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Scan in Session A
    const resA = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessA.session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      clientEventId: `evt-sessA-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });
    expect(resA.success).toBe(true);
    expect(resA.idempotentDuplicate).toBeUndefined();

    // Scan in Session B
    const resB = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessB.session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      clientEventId: `evt-sessB-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });
    expect(resB.success).toBe(true);
    expect(resB.idempotentDuplicate).toBeUndefined();
    expect(resB.record.attendanceSessionId).toBe(sessB.session.id);
  });

  it('locks finalized session against sync events and flags conflicts', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-09-08',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Finalize session
    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      newStatus: 'FINALIZED',
    });

    // Sync event for finalized session
    const syncRes = await syncAttendanceEvents({
      schoolId: seeded.schoolA.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      deviceIdentifier: deviceA1.deviceIdentifier,
      events: [
        {
          clientEventId: 'evt-finalized-sync',
          sessionId: sessionRes.session.id,
          studentId: studentA1.student.id,
          rawToken: qrA1.rawToken,
          clientTimestamp: new Date().toISOString(),
        },
      ],
    });

    expect(syncRes.results[0].status).toBe('REJECTED');
    expect(syncRes.results[0].error).toBe('FINALIZED_SESSION_LOCKED');

    // Verify conflict flag set on record
    const [rec] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, seeded.schoolA.id),
          eq(attendanceRecords.attendanceSessionId, sessionRes.session.id),
          eq(attendanceRecords.studentId, studentA1.student.id)
        )
      );

    expect(rec?.hasConflict).toBe(true);
  });
});
