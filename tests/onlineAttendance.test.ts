import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import { createStudent } from '../src/services/studentService';
import { createQrCredential, revokeQrCredential } from '../src/services/qrService';
import {
  createAttendanceSession,
  updateSessionStatus,
  processQRCode,
  manualStatusUpdate,
  getAttendanceSessionDetails,
  getTeacherAssignedClasses,
} from '../src/services/attendanceService';
import { attendanceSessionRoster, students, enrollments, attendanceCorrections } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Online Daily Attendance Engine & Invariants', () => {
  let seeded: any;
  let studentA1: any;
  let studentA2: any;
  let studentB1: any;
  let qrA1: any;
  let qrA2: any;
  let qrB1: any;

  beforeEach(async () => {
    seeded = await seedDatabase();

    const uid1 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid2 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid3 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Create Student 1 in School A, Class 5A
    studentA1 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-ATT-1-${uid1}`,
      name: 'Pritam Chakrabarty',
      nameBn: 'প্রীতম চক্রবর্তী',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 1,
    });

    // Create Student 2 in School A, Class 5A
    studentA2 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-ATT-2-${uid2}`,
      name: 'Shreya Ghoshal',
      nameBn: 'শ্রেয়া ঘোষাল',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 2,
    });

    // Create Student 3 in School B, Class 6A
    studentB1 = await createStudent({
      schoolId: seeded.schoolB.id,
      studentCode: `STU-ATT-3-${uid3}`,
      name: 'Arijit Singh',
      nameBn: 'অরিজিৎ সিং',
      classSectionId: seeded.schoolBClass6A.id,
      academicYearId: seeded.academicYearB.id,
      rollNumber: 1,
    });

    // Issue QR credentials
    qrA1 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA1.student.id });
    qrA2 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA2.student.id });
    qrB1 = await createQrCredential(db, { schoolId: seeded.schoolB.id, studentId: studentB1.student.id });
  });

  it('enforces teacher assignment permissions when fetching assigned classes', async () => {
    // School Admin sees all class sections in School A
    const adminClasses = await getTeacherAssignedClasses({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
    });
    expect(adminClasses.length).toBeGreaterThan(0);

    // Teacher user only sees assigned classes
    const teacherClasses = await getTeacherAssignedClasses({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });
    expect(teacherClasses.some((c: any) => c.classSectionId === seeded.schoolAClass5A.id)).toBe(true);
  });

  it('guarantees session uniqueness per school, class section, date and session type', async () => {
    const date = '2026-08-11';
    const firstCall = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: date,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    expect(firstCall.isNew).toBe(true);

    const secondCall = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: date,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    expect(secondCall.isNew).toBe(false);
    expect(secondCall.session.id).toBe(firstCall.session.id);
  });

  it('creates immutable historical roster snapshot upon session creation', async () => {
    const date = '2026-08-12';
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: date,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Check roster snapshot contains studentA1 with rollNumber 1 and student name "Pritam Chakrabarty"
    const detailsBefore = await getAttendanceSessionDetails(seeded.schoolA.id, sessionRes.session.id);
    const itemBefore = detailsBefore?.roster.find((r: any) => r.studentId === studentA1.student.id);
    expect(itemBefore?.studentName).toBe('Pritam Chakrabarty');
    expect(itemBefore?.rollNumber).toBe(1);

    // Now update studentA1 name in main students table
    await db
      .update(students)
      .set({ name: 'Pritam Chakrabarty (Modified Name)' })
      .where(eq(students.id, studentA1.student.id));

    // Roster snapshot in existing attendance session MUST NOT change
    const detailsAfter = await getAttendanceSessionDetails(seeded.schoolA.id, sessionRes.session.id);
    const itemAfter = detailsAfter?.roster.find((r: any) => r.studentId === studentA1.student.id);
    expect(itemAfter?.studentName).toBe('Pritam Chakrabarty');
  });

  it('successfully processes valid QR scan and records timestamps', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-13',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    const scanRes = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-valid-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
      source: 'CAMERA',
    });

    expect(scanRes.success).toBe(true);
    expect(scanRes.duplicateScan).toBe(false);
    expect(scanRes.record.status).toBe('PRESENT');
    expect(scanRes.student.name).toBe('Pritam Chakrabarty');
  });

  it('detects duplicate QR scan and prevents duplicate attendance records', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-14',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // First scan
    await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-dup-1-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    // Second scan with different clientEventId
    const dupRes = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-dup-2-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.duplicateScan).toBe(true);
    expect(dupRes.error).toBe('DUPLICATE_SCAN_DETECTED');
  });

  it('rejects wrong-school QR code scans', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-15',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Scan School B QR in School A session
    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        clientEventId: 'evt-wrong-school-001',
        rawToken: qrB1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('WRONG_SCHOOL_QR');
  });

  it('rejects revoked QR codes', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-16',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Revoke studentA1 QR
    await revokeQrCredential(seeded.schoolA.id, studentA1.student.id);

    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        clientEventId: 'evt-revoked-001',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('REVOKED_QR_TOKEN');
  });

  it('rejects student not in session roster', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-17',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Create another student in Class 6A (School A)
    const student6A = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-6A-${Math.floor(Math.random() * 100000)}`,
      name: 'Kishore Kumar',
      classSectionId: seeded.schoolAClass6A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 1,
    });
    const qr6A = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: student6A.student.id });

    // Try scanning Class 6A student in Class 5A session
    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        clientEventId: `evt-roster-${Math.random()}`,
        rawToken: qr6A.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('STUDENT_NOT_IN_ROSTER');
  });

  it('rejects unassigned teacher when creating attendance session', async () => {
    const unassignedTeacherId = seeded.superAdminUser.id; // or teacher not assigned
    await expect(
      createAttendanceSession({
        schoolId: seeded.schoolA.id,
        classSectionId: seeded.schoolAClass6A.id,
        teacherId: unassignedTeacherId,
        sessionDate: '2026-08-18',
        actorId: unassignedTeacherId,
        userRole: 'TEACHER', // as TEACHER role without assignment
      })
    ).rejects.toThrow('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
  });

  it('locks finalized session against further scan modifications', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-19',
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
      autoMarkAbsentForUnmarked: true,
    });

    // Scans in finalized session must fail
    await expect(
      processQRCode({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        clientEventId: 'evt-finalized-001',
        rawToken: qrA1.rawToken,
        clientTimestamp: new Date().toISOString(),
      })
    ).rejects.toThrow('FINALIZED_SESSION_LOCKED');
  });

  it('enforces reopen permissions and requires non-empty reason', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-20',
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

    // Teacher attempting reopen must fail
    await expect(
      updateSessionStatus({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.teacherUser.id,
        userRole: 'TEACHER',
        newStatus: 'REOPENED',
        reason: 'Correction needed',
      })
    ).rejects.toThrow('REOPEN_REQUIRES_ADMIN_ROLE');

    // Admin attempting reopen WITHOUT reason must fail
    await expect(
      updateSessionStatus({
        schoolId: seeded.schoolA.id,
        sessionId: sessionRes.session.id,
        actorId: seeded.schoolAdminUser.id,
        userRole: 'SCHOOL_ADMIN',
        newStatus: 'REOPENED',
        reason: '',
      })
    ).rejects.toThrow('REOPEN_REASON_REQUIRED');

    // Admin reopening WITH reason must succeed
    const reopened = await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.schoolAdminUser.id,
      userRole: 'SCHOOL_ADMIN',
      newStatus: 'REOPENED',
      reason: 'Late student arrived with parent note',
    });

    expect(reopened.status).toBe('REOPENED');
  });

  it('records correction audit trail when manually adjusting attendance status', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-21',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Mark studentA1 Present initially
    await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-corr-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    // Perform manual correction with reason
    const updated = await manualStatusUpdate({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      studentId: studentA1.student.id,
      newStatus: 'LATE',
      reason: 'Student arrived 20 minutes late due to rain',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    expect(updated.status).toBe('LATE');

    // Check correction log
    const corrections = await db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.attendanceRecordId, updated.id));

    expect(corrections.length).toBe(1);
    expect(corrections[0].previousStatus).toBe('PRESENT');
    expect(corrections[0].newStatus).toBe('LATE');
    expect(corrections[0].reason).toBe('Student arrived 20 minutes late due to rain');
  });

  it('handles client event idempotency for duplicate event submissions', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-22',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    const clientEventId = 'evt-idempotent-unique-12345';

    const res1 = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    expect(res1.success).toBe(true);

    // Resend exact same clientEventId
    const res2 = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
    });

    expect(res2.success).toBe(true);
    expect(res2.idempotentDuplicate).toBe(true);
  });

  it('processes USB wedge and camera barcode inputs through the same shared processQRCode path', async () => {
    const sessionRes = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      classSectionId: seeded.schoolAClass5A.id,
      teacherId: seeded.teacherUser.id,
      sessionDate: '2026-08-23',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Camera Scan
    const cameraRes = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-cam-${Math.random()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date().toISOString(),
      source: 'CAMERA',
    });

    // USB Scanner Scan
    const usbRes = await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sessionRes.session.id,
      actorId: seeded.teacherUser.id,
      clientEventId: `evt-usb-${Math.random()}`,
      rawToken: qrA2.rawToken,
      clientTimestamp: new Date().toISOString(),
      source: 'USB',
    });

    expect(cameraRes.success).toBe(true);
    expect(usbRes.success).toBe(true);
    expect(cameraRes.record.status).toBe('PRESENT');
    expect(usbRes.record.status).toBe('PRESENT');
  });
});
