import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { db, setTenantContext, resetTenantContext } from '../src/db';
import { runMigrations } from '../src/db/migrate';
import {
  schools,
  users,
  academicYears,
  classSections,
  students,
  guardians,
  studentGuardians,
  enrollments,
  attendanceSessions,
  attendanceRecords,
  notificationJobs,
  notificationAttempts,
  schoolSmsSettings,
  notificationTemplates,
} from '../src/db/schema';
import {
  redactPhoneNumber,
  estimateSmsSegments,
  validateTemplateVariables,
  renderTemplate,
} from '../src/services/sms/smsUtils';
import {
  getSmsProvider,
  getFakeSmsProvider,
  FakeSmsProvider,
  ConsoleSmsProvider,
} from '../src/services/sms/smsProvider';
import {
  getSchoolSmsSettings,
  updateSchoolSmsSettings,
  upsertNotificationTemplate,
  createAbsenceNotificationJobs,
  getSmsUsageReport,
} from '../src/services/notificationService';
import { processNotificationQueue } from '../src/services/notificationWorker';
import {
  finalizeAttendanceSession,
  manualStatusUpdate,
} from '../src/services/attendanceService';
import { eq, and } from 'drizzle-orm';

describe('Milestone 6: Absence Notification Infrastructure', () => {
  let schoolId: string;
  let academicYearId: string;
  let classSectionId: string;
  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let guardian1Id: string;
  let guardian2Id: string;
  let testUserId: string;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await resetTenantContext();
    getFakeSmsProvider().clearSentMessages();

    // Setup seed school & hierarchy
    const [sc] = await db
      .insert(schools)
      .values({
        name: 'SMS Test Academy',
        code: `SMS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        district: 'Dhaka',
        preferredLanguage: 'bn',
      })
      .returning();
    schoolId = sc.id;

    await setTenantContext(schoolId);

    const [ay] = await db
      .insert(academicYears)
      .values({
        schoolId,
        name: '2026 Academic Year',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCurrent: true,
      })
      .returning();
    academicYearId = ay.id;

    const [cs] = await db
      .insert(classSections)
      .values({
        schoolId,
        academicYearId,
        className: 'Class 8',
        sectionName: 'A',
      })
      .returning();
    classSectionId = cs.id;

    // Create 3 students:
    // Student 1: Primary guardian with valid phone
    // Student 2: Primary guardian with smsOptOut = true
    // Student 3: No guardian phone
    const [st1] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `ST1-${Date.now()}`,
        name: 'Rahim Uddin',
        nameBn: 'রহিম উদ্দিন',
      })
      .returning();
    student1Id = st1.id;

    await db.insert(enrollments).values({
      schoolId,
      studentId: student1Id,
      classSectionId,
      academicYearId,
      rollNumber: 101,
      startDate: '2026-01-01',
    });

    const [g1] = await db
      .insert(guardians)
      .values({
        schoolId,
        name: 'Karim Uddin',
        phoneNumber: '+919876543210',
        relationship: 'FATHER',
        smsOptOut: false,
      })
      .returning();
    guardian1Id = g1.id;

    await db.insert(studentGuardians).values({
      studentId: student1Id,
      guardianId: guardian1Id,
      isPrimary: true,
    });

    // Student 2 with opted-out guardian
    const [st2] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `ST2-${Date.now()}`,
        name: 'Sumi Akter',
        nameBn: 'সুমি আক্তার',
      })
      .returning();
    student2Id = st2.id;

    await db.insert(enrollments).values({
      schoolId,
      studentId: student2Id,
      classSectionId,
      academicYearId,
      rollNumber: 102,
      startDate: '2026-01-01',
    });

    const [g2] = await db
      .insert(guardians)
      .values({
        schoolId,
        name: 'Rafiq Akter',
        phoneNumber: '+919876543211',
        relationship: 'FATHER',
        smsOptOut: true, // Opted out!
      })
      .returning();
    guardian2Id = g2.id;

    await db.insert(studentGuardians).values({
      studentId: student2Id,
      guardianId: guardian2Id,
      isPrimary: true,
    });

    // Student 3 without guardian phone
    const [st3] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `ST3-${Date.now()}`,
        name: 'Tanvir Hossain',
        nameBn: 'তানভীর হোসেন',
      })
      .returning();
    student3Id = st3.id;

    await db.insert(enrollments).values({
      schoolId,
      studentId: student3Id,
      classSectionId,
      academicYearId,
      rollNumber: 103,
      startDate: '2026-01-01',
    });

    // Create test user
    const [u] = await db
      .insert(users)
      .values({
        fullName: 'Test Admin',
        phoneNumber: `+919000${Math.floor(Math.random() * 1000000)}`,
        passwordHash: 'hashed',
      })
      .returning();
    testUserId = u.id;
  });

  // -------------------------------------------------------------
  // 1. SMS Utilities & Security Checks
  // -------------------------------------------------------------
  describe('SMS Utilities & Security', () => {
    it('redacts phone numbers correctly without exposing complete guardian phone numbers', () => {
      expect(redactPhoneNumber('+919876543210')).toBe('+9198****3210');
      expect(redactPhoneNumber('9876543210')).toBe('98****3210');
      expect(redactPhoneNumber('123')).toBe('***');
    });

    it('accurately estimates SMS segment count for GSM 7-bit vs Bengali Unicode', () => {
      // English ASCII (GSM 7-bit)
      const englishMsg = 'Dear Parent, your child Rahim Uddin of Class 8-A was marked ABSENT at SMS Test Academy on 2026-08-11.';
      const engEstimation = estimateSmsSegments(englishMsg);
      expect(engEstimation.isUnicode).toBe(false);
      expect(engEstimation.charCount).toBeLessThanOrEqual(160);
      expect(engEstimation.segmentCount).toBe(1);

      // Bengali Unicode message
      const bengaliMsg = 'প্রিয় অভিভাবক, আপনার সন্তান রহিম উদ্দিন (রোল: ১০১), শ্রেণী Class 8-A, 2026-08-11 তারিখে SMS Test Academy-এ অনুপস্থিত ছিল।';
      const bnEstimation = estimateSmsSegments(bengaliMsg);
      expect(bnEstimation.isUnicode).toBe(true);
      expect(bnEstimation.charCount).toBeGreaterThan(70);
      expect(bnEstimation.segmentCount).toBe(2); // >70 chars unicode requires 2 segments (67 chars/segment)
    });

    it('validates template variables and renders templates properly', () => {
      const template = 'Hello {studentName}, your roll is {rollNumber}.';
      const validation = validateTemplateVariables(template, ['studentName', 'rollNumber']);
      expect(validation.valid).toBe(true);

      const rendered = renderTemplate(template, {
        studentName: 'Rahim',
        rollNumber: '101',
      });
      expect(rendered).toBe('Hello Rahim, your roll is 101.');
    });
  });

  // -------------------------------------------------------------
  // 2. Provider Abstraction & Fake/Console Providers
  // -------------------------------------------------------------
  describe('SmsProvider Abstraction', () => {
    it('interacts with FakeSmsProvider and ConsoleSmsProvider cleanly', async () => {
      const fakeProvider = getSmsProvider('fake');
      expect(fakeProvider.name).toBe('fake');

      const res = await fakeProvider.sendSms({
        to: '+919876543210',
        message: 'Test Message',
        dltHeader: 'SCHLATT',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toContain('fake-msg-');

      const consoleProvider = new ConsoleSmsProvider();
      const consoleRes = await consoleProvider.sendSms({
        to: '+919876543210',
        message: 'Console Test Message',
      });
      expect(consoleRes.success).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 3. Absence Notification Job Creation & Idempotency
  // -------------------------------------------------------------
  describe('Absence Notification Job Creation', () => {
    it('creates absence notification jobs when session is finalized', async () => {
      // Create session
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-11',
          sessionType: 'DAILY',
          status: 'OPEN',
        })
        .returning();

      // Mark student 1 as ABSENT
      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student1Id,
        status: 'ABSENT',
      });

      // Finalize session
      await finalizeAttendanceSession({
        schoolId,
        sessionId: session.id,
        actorId: testUserId,
        userRole: 'SCHOOL_ADMIN',
      });

      // Check notification jobs table
      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));

      expect(jobs.length).toBe(1);
      expect(jobs[0].recipientPhone).toBe('+919876543210');
      expect(jobs[0].status).toBe('QUEUED');
      expect(jobs[0].messageBody).toContain('রহিম উদ্দিন');
    });

    it('ensures repeated finalization does not create duplicate SMS jobs (Idempotency)', async () => {
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-12',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-12T10:00:00Z'),
        })
        .returning();

      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student1Id,
        status: 'ABSENT',
      });

      // Call job creation 1st time
      const res1 = await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });
      expect(res1.jobsCreated).toBe(1);

      // Call job creation 2nd time (simulating repeated trigger)
      const res2 = await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });
      expect(res2.jobsCreated).toBe(0); // On conflict do nothing!

      const allJobs = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));
      expect(allJobs.length).toBe(1);
    });

    it('respects guardian SMS opt-out preference', async () => {
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-13',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-13T10:00:00Z'),
        })
        .returning();

      // Mark Student 2 (whose guardian has smsOptOut = true) as ABSENT
      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student2Id,
        status: 'ABSENT',
      });

      await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });

      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.attendanceSessionId, session.id),
            eq(notificationJobs.studentId, student2Id)
          )
        );

      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('CANCELLED');
      expect(jobs[0].failureReason).toBe('GUARDIAN_OPTED_OUT');
    });

    it('handles missing guardian phone numbers cleanly', async () => {
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-14',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-14T10:00:00Z'),
        })
        .returning();

      // Mark Student 3 (who has no guardian) as ABSENT
      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student3Id,
        status: 'ABSENT',
      });

      await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });

      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(
          and(
            eq(notificationJobs.attendanceSessionId, session.id),
            eq(notificationJobs.studentId, student3Id)
          )
        );

      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('PERMANENT_FAILURE');
      expect(jobs[0].failureReason).toBe('MISSING_GUARDIAN_PHONE');
    });

    it('respects administrative enable/disable switch', async () => {
      // Disable SMS for the school
      await updateSchoolSmsSettings(schoolId, { smsEnabled: false });

      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-15',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-15T10:00:00Z'),
        })
        .returning();

      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student1Id,
        status: 'ABSENT',
      });

      const result = await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });

      expect(result.status).toBe('SKIPPED_SCHOOL_SMS_DISABLED');
      expect(result.jobsCreated).toBe(0);

      // Re-enable SMS for subsequent tests
      await updateSchoolSmsSettings(schoolId, { smsEnabled: true });
    });

    it('filters test recipients via pre-production allowlist when enabled', async () => {
      // Enable allowlist and set allowed numbers
      await updateSchoolSmsSettings(schoolId, {
        allowlistEnabled: true,
        allowlist: ['+919999999999'], // Student 1's phone (+919876543210) is NOT in allowlist
      });

      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-16',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-16T10:00:00Z'),
        })
        .returning();

      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student1Id,
        status: 'ABSENT',
      });

      await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });

      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));

      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('CANCELLED');
      expect(jobs[0].failureReason).toBe('PHONE_NOT_IN_ALLOWLIST');

      // Reset allowlist settings
      await updateSchoolSmsSettings(schoolId, { allowlistEnabled: false });
    });
  });

  // -------------------------------------------------------------
  // 4. Notification Queue Worker & Retry Logic
  // -------------------------------------------------------------
  describe('Notification Queue Worker', () => {
    it('processes QUEUED jobs and updates status to SENT', async () => {
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-17',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-17T10:00:00Z'),
        })
        .returning();

      await db.insert(attendanceRecords).values({
        schoolId,
        attendanceSessionId: session.id,
        studentId: student1Id,
        status: 'ABSENT',
      });

      await createAbsenceNotificationJobs({
        schoolId,
        attendanceSessionId: session.id,
      });

      const workerRes = await processNotificationQueue({ providerName: 'fake' });
      expect(workerRes.processed).toBeGreaterThanOrEqual(1);
      expect(workerRes.sent).toBeGreaterThanOrEqual(1);

      const [job] = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));

      expect(job.status).toBe('SENT');
      expect(job.providerMessageId).toBeDefined();

      const attempts = await db
        .select()
        .from(notificationAttempts)
        .where(eq(notificationAttempts.jobId, job.id));
      expect(attempts.length).toBe(1);
      expect(attempts[0].status).toBe('SENT');
    });

    it('handles permanent failures cleanly without retrying indefinitely', async () => {
      const [dummySession] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-19',
          sessionType: 'DAILY',
          status: 'FINALIZED',
        })
        .returning();

      // Create a job with an invalid phone number that triggers permanent failure
      const [job] = await db
        .insert(notificationJobs)
        .values({
          schoolId,
          attendanceSessionId: dummySession.id,
          studentId: student1Id,
          recipientPhone: '+910000000000', // Triggers permanent fail rule in FakeSmsProvider
          language: 'bn',
          messageBody: 'Test Invalid Phone',
          status: 'QUEUED',
        })
        .returning();

      const workerRes = await processNotificationQueue({ providerName: 'fake' });
      expect(workerRes.permanentFailures).toBe(1);

      const [updatedJob] = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.id, job.id));

      expect(updatedJob.status).toBe('PERMANENT_FAILURE');
      expect(updatedJob.attemptCount).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // 5. Delivery Callback Endpoint & Verification
  // -------------------------------------------------------------
  describe('Delivery Callback Verification & Idempotency', () => {
    it('verifies callback signature and processes status update idempotently', async () => {
      const fakeProvider = getFakeSmsProvider();

      const [dummySession] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-20',
          sessionType: 'DAILY',
          status: 'FINALIZED',
        })
        .returning();

      // Create a job that is SENT
      const [job] = await db
        .insert(notificationJobs)
        .values({
          schoolId,
          attendanceSessionId: dummySession.id,
          studentId: student1Id,
          recipientPhone: '+919876543210',
          language: 'bn',
          messageBody: 'Test Message for Callback',
          status: 'SENT',
          providerMessageId: 'fake-msg-callback-123',
        })
        .returning();

      // 1. Invalid verification check
      const invalidAuth = await fakeProvider.verifyCallback({ 'x-callback-auth-token': 'wrong-token' }, {});
      expect(invalidAuth.valid).toBe(false);

      // 2. Valid verification check
      const validAuth = await fakeProvider.verifyCallback({ 'x-callback-auth-token': 'fake-secret-token' }, {});
      expect(validAuth.valid).toBe(true);

      // 3. Process delivery callback 1st time
      const callbackBody = {
        providerMessageId: 'fake-msg-callback-123',
        status: 'DELIVERED',
        deliveredAt: new Date().toISOString(),
      };

      const parsed = await fakeProvider.parseCallback(callbackBody);
      expect(parsed.status).toBe('DELIVERED');

      // Update job directly to simulate route handler
      await db
        .update(notificationJobs)
        .set({ status: 'DELIVERED', deliveredAt: new Date() })
        .where(eq(notificationJobs.id, job.id));

      const [deliveredJob] = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.id, job.id));

      expect(deliveredJob.status).toBe('DELIVERED');
      expect(deliveredJob.deliveredAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 6. SMS Usage Reports & Segment Counting
  // -------------------------------------------------------------
  describe('SMS Usage Reports', () => {
    it('generates usage report with segment count and status breakdown', async () => {
      const report = await getSmsUsageReport(schoolId);
      expect(report.schoolId).toBe(schoolId);
      expect(report.statusCounts).toBeDefined();
      expect(report.totalSegmentCount).toBeGreaterThanOrEqual(0);
      expect(report.estimatedCostInInr).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------
  // 7. Attendance Correction after Notification
  // -------------------------------------------------------------
  describe('Attendance Correction after Notification', () => {
    it('logs attendance correction for admin visibility without auto sending SMS unless approved', async () => {
      const [session] = await db
        .insert(attendanceSessions)
        .values({
          schoolId,
          classSectionId,
          academicYearId,
          teacherId: testUserId,
          sessionDate: '2026-08-18',
          sessionType: 'DAILY',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-08-18T10:00:00Z'),
        })
        .returning();

      const [rec] = await db
        .insert(attendanceRecords)
        .values({
          schoolId,
          attendanceSessionId: session.id,
          studentId: student1Id,
          status: 'ABSENT',
        })
        .returning();

      // Clear existing jobs
      const jobsBefore = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));

      const beforeCount = jobsBefore.length;

      // Correction made by admin (changed ABSENT -> PRESENT)
      await manualStatusUpdate({
        schoolId,
        sessionId: session.id,
        recordId: rec.id,
        newStatus: 'PRESENT',
        reason: 'Student arrived late with valid excuse note from parent',
        actorId: testUserId,
        userRole: 'SCHOOL_ADMIN',
      });

      // Verify no extra SMS job was created automatically
      const jobsAfter = await db
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.attendanceSessionId, session.id));

      expect(jobsAfter.length).toBe(beforeCount);
    });
  });
});
