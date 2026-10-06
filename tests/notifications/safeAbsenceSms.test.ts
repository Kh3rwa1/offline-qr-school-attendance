import { describe, it, expect, beforeEach } from 'vitest';
import { db, withTenantContext } from '../../src/db';
import {
  students,
  guardians,
  studentGuardians,
  attendanceSessions,
  attendanceRecords,
  notificationJobs,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { scheduleAbsenceSms, onAttendanceCorrected } from '../../src/services/notifications/absenceScheduler';
import { processNotificationQueue } from '../../src/services/notificationWorker';
import { recordConsent, withdrawConsent } from '../../src/services/privacy/consent';
import { seedDatabase } from '../../src/db/seed';

describe('Part D2 — Safe Absence SMS & Delay Window', () => {
  let schoolId: string;
  let sessionId: string;
  let studentId: string;
  let recordId: string;

  beforeEach(async () => {
    const seed = await seedDatabase();
    schoolId = seed.schoolA.id;

    // Create session
    const [sess] = await db.insert(attendanceSessions).values({
      schoolId,
      classSectionId: seed.schoolAClass5A.id,
      teacherId: seed.teacherUser.id,
      sessionDate: '2026-11-03',
      status: 'OPEN',
    }).returning();
    sessionId = sess.id;

    // Create student
    const [st] = await db.insert(students).values({
      schoolId,
      studentCode: `SAFE-SMS-${Date.now()}`,
      name: 'Safe SMS Student',
      status: 'ACTIVE',
    }).returning();
    studentId = st.id;

    // Create guardian
    const [g] = await db.insert(guardians).values({
      schoolId,
      name: 'Guardian Test',
      phoneNumber: '9876543210',
    }).returning();

    await db.insert(studentGuardians).values({
      studentId,
      guardianId: g.id,
      isPrimary: true,
    });

    // Create ABSENT attendance record
    const [rec] = await db.insert(attendanceRecords).values({
      schoolId,
      attendanceSessionId: sessionId,
      studentId,
      status: 'ABSENT',
      captureMethod: 'MANUAL',
      source: 'MANUAL',
    }).returning();
    recordId = rec.id;

    // Grant consent for ABSENCE_SMS
    await recordConsent(db, {
      schoolId,
      studentId,
      purpose: 'ABSENCE_SMS',
      granted: true,
    });
  });

  it('scheduleAbsenceSms: schedules notification job with future sendAfter timestamp', async () => {
    const count = await withTenantContext(schoolId, async (tx) => {
      return scheduleAbsenceSms(tx, { schoolId, sessionId });
    });

    expect(count).toBe(1);

    const [job] = await db
      .select()
      .from(notificationJobs)
      .where(and(eq(notificationJobs.attendanceRecordId, recordId), eq(notificationJobs.kind, 'ABSENCE')));

    expect(job).toBeDefined();
    expect(job.status).toBe('SCHEDULED');
    expect(job.sendAfter).toBeDefined();
    expect(new Date(job.sendAfter!).getTime()).toBeGreaterThan(Date.now());
  });

  it('teacher fixes ABSENT -> PRESENT inside delay window -> cancels scheduled job silently', async () => {
    await withTenantContext(schoolId, async (tx) => {
      await scheduleAbsenceSms(tx, { schoolId, sessionId });
    });

    // Teacher corrects status to PRESENT inside window
    await withTenantContext(schoolId, async (tx) => {
      await onAttendanceCorrected(tx, {
        id: recordId,
        schoolId,
        studentId,
        from: 'ABSENT',
        to: 'PRESENT',
      });
    });

    const [job] = await db
      .select()
      .from(notificationJobs)
      .where(and(eq(notificationJobs.attendanceRecordId, recordId), eq(notificationJobs.kind, 'ABSENCE')));

    expect(job.status).toBe('CANCELLED');
    expect(job.cancelledReason).toBe('CORRECTED_BEFORE_SEND');
  });

  it('teacher fixes status after SMS was SENT -> creates exactly one CORRECTION notification', async () => {
    // Insert a SENT absence job
    await db.insert(notificationJobs).values({
      schoolId,
      attendanceSessionId: sessionId,
      studentId,
      attendanceRecordId: recordId,
      recipientPhone: '9876543210',
      messageBody: 'Child is absent',
      kind: 'ABSENCE',
      status: 'SENT',
      sendAfter: new Date(Date.now() - 3600000),
      sentAt: new Date(),
    });

    // Teacher corrects to PRESENT after send
    await withTenantContext(schoolId, async (tx) => {
      await onAttendanceCorrected(tx, {
        id: recordId,
        schoolId,
        studentId,
        from: 'ABSENT',
        to: 'PRESENT',
      });
    });

    const corrections = await db
      .select()
      .from(notificationJobs)
      .where(and(eq(notificationJobs.attendanceRecordId, recordId), eq(notificationJobs.kind, 'CORRECTION')));

    expect(corrections.length).toBe(1);
    expect(corrections[0].status).toBe('SCHEDULED');
    expect(corrections[0].kind).toBe('CORRECTION');
  });

  it('worker safety check: cancels job with STATUS_CHANGED if record is no longer ABSENT at dispatch time', async () => {
    // Schedule a due job
    const [job] = await db.insert(notificationJobs).values({
      schoolId,
      attendanceSessionId: sessionId,
      studentId,
      attendanceRecordId: recordId,
      recipientPhone: '9876543210',
      messageBody: 'Child is absent',
      kind: 'ABSENCE',
      status: 'SCHEDULED',
      sendAfter: new Date(Date.now() - 1000), // already due
    }).returning();

    // Student marked PRESENT directly in record
    await db.update(attendanceRecords).set({ status: 'PRESENT' }).where(eq(attendanceRecords.id, recordId));

    // Run worker
    await processNotificationQueue({ schoolId });

    const [updatedJob] = await db.select().from(notificationJobs).where(eq(notificationJobs.id, job.id));
    expect(updatedJob.status).toBe('CANCELLED');
    expect(updatedJob.failureReason).toBe('STATUS_CHANGED');
  });

  it('worker consent check: cancels job with NO_CONSENT if guardian withdrew consent', async () => {
    // Withdraw consent
    await withdrawConsent(db, { schoolId, studentId, purpose: 'ABSENCE_SMS' });

    // Schedule due job
    const [job] = await db.insert(notificationJobs).values({
      schoolId,
      attendanceSessionId: sessionId,
      studentId,
      attendanceRecordId: recordId,
      recipientPhone: '9876543210',
      messageBody: 'Child is absent',
      kind: 'ABSENCE',
      status: 'SCHEDULED',
      sendAfter: new Date(Date.now() - 1000), // already due
    }).returning();

    await processNotificationQueue({ schoolId });

    const [updatedJob] = await db.select().from(notificationJobs).where(eq(notificationJobs.id, job.id));
    expect(updatedJob.status).toBe('CANCELLED');
    expect(updatedJob.failureReason).toBe('NO_CONSENT');
  });
});
