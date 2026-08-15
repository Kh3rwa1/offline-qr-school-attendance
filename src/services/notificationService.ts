import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  schools,
  attendanceSessions,
  attendanceRecords,
  students,
  enrollments,
  classSections,
  guardians,
  studentGuardians,
  notificationTemplates,
  schoolSmsSettings,
  notificationJobs,
  auditLogs,
} from '../db/schema';
import { estimateSmsSegments, renderTemplate, validateTemplateVariables } from './sms/smsUtils';

export const DEFAULT_TEMPLATES = {
  bn: {
    templateCode: 'ABSENCE',
    language: 'bn',
    content: 'প্রিয় অভিভাবক, আপনার সন্তান {studentNameBn} (রোল: {rollNumber}), শ্রেণী {className}-{sectionName}, {date} তারিখে {schoolName}-এ অনুপস্থিত ছিল।',
    dltTemplateId: 'DLT-BN-ABSENCE-1001',
  },
  en: {
    templateCode: 'ABSENCE',
    language: 'en',
    content: 'Dear Parent, your child {studentName} (Roll: {rollNumber}) of Class {className}-{sectionName} was marked ABSENT at {schoolName} on {date}.',
    dltTemplateId: 'DLT-EN-ABSENCE-1002',
  },
};

// 1. Get School SMS Settings
export async function getSchoolSmsSettings(schoolId: string, tx?: any) {
  const client = tx || db;
  const [existing] = await client
    .select()
    .from(schoolSmsSettings)
    .where(eq(schoolSmsSettings.schoolId, schoolId));

  if (existing) {
    return existing;
  }

  // Insert default settings
  const [created] = await client
    .insert(schoolSmsSettings)
    .values({
      schoolId,
      smsEnabled: true,
      dltPrincipalEntityId: '100100100100',
      dltHeader: 'SCHLATT',
      allowlistEnabled: false,
      allowlist: [],
    })
    .returning();

  return created;
}

// 2. Update School SMS Settings
export async function updateSchoolSmsSettings(
  schoolId: string,
  settings: Partial<{
    smsEnabled: boolean;
    dltPrincipalEntityId: string;
    dltHeader: string;
    allowlistEnabled: boolean;
    allowlist: string[];
  }>
) {
  const current = await getSchoolSmsSettings(schoolId);

  const [updated] = await db
    .update(schoolSmsSettings)
    .set({
      ...settings,
      updatedAt: new Date(),
    })
    .where(eq(schoolSmsSettings.id, current.id))
    .returning();

  return updated;
}

// 3. Notification Templates Management
export async function getNotificationTemplates(schoolId: string) {
  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.schoolId, schoolId));

  return templates;
}

export async function upsertNotificationTemplate(
  schoolId: string,
  templateCode: string,
  language: string,
  content: string,
  dltTemplateId?: string
) {
  // Validate template variables syntax
  const { valid, missingVars } = validateTemplateVariables(content);
  if (!valid) {
    throw new Error(`INVALID_TEMPLATE_VARIABLES: Missing ${missingVars.join(', ')}`);
  }

  const [existing] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.schoolId, schoolId),
        eq(notificationTemplates.templateCode, templateCode),
        eq(notificationTemplates.language, language)
      )
    );

  if (existing) {
    const [updated] = await db
      .update(notificationTemplates)
      .set({
        content,
        dltTemplateId: dltTemplateId || existing.dltTemplateId,
      })
      .where(eq(notificationTemplates.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(notificationTemplates)
    .values({
      schoolId,
      templateCode,
      language,
      content,
      dltTemplateId: dltTemplateId || null,
    })
    .returning();

  return inserted;
}

// 4. Create Absence Notification Jobs upon Session Finalization
export async function createAbsenceNotificationJobs(params: {
  schoolId: string;
  attendanceSessionId: string;
  actorId?: string;
  tx?: any;
}) {
  const { schoolId, attendanceSessionId, tx } = params;
  const client = tx || db;

  // Rule: Check school SMS settings. If school SMS is disabled, do not create jobs.
  const smsSettings = await getSchoolSmsSettings(schoolId, tx);
  if (!smsSettings.smsEnabled) {
    return {
      status: 'SKIPPED_SCHOOL_SMS_DISABLED',
      jobsCreated: 0,
      jobs: [],
    };
  }

  // Fetch session details
  const [session] = await client
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, attendanceSessionId), eq(attendanceSessions.schoolId, schoolId)));

  if (!session) {
    throw new Error('ATTENDANCE_SESSION_NOT_FOUND');
  }

  if (session.status !== 'FINALIZED') {
    throw new Error('SESSION_NOT_FINALIZED');
  }

  // Version identifier for idempotency
  const finalizedVersion = session.finalizedAt
    ? session.finalizedAt.getTime().toString()
    : 'v1';

  // Fetch School & Class info
  const [school] = await client.select().from(schools).where(eq(schools.id, schoolId));
  const [classSec] = await client
    .select()
    .from(classSections)
    .where(eq(classSections.id, session.classSectionId));

  // Fetch absent students in this session
  const absentRecords = await client
    .select({
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.attendanceSessionId, attendanceSessionId),
        eq(attendanceRecords.schoolId, schoolId),
        eq(attendanceRecords.status, 'ABSENT')
      )
    );

  if (absentRecords.length === 0) {
    return {
      status: 'NO_ABSENT_STUDENTS',
      jobsCreated: 0,
      jobs: [],
    };
  }

  const studentIds = absentRecords.map((r: any) => r.studentId);

  // Fetch student details & enrollments
  const studentRows = await client
    .select({
      studentId: students.id,
      name: students.name,
      nameBn: students.nameBn,
      rollNumber: enrollments.rollNumber,
    })
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(enrollments.classSectionId, session.classSectionId),
        inArray(students.id, studentIds)
      )
    );

  type StudentRow = {
    studentId: string;
    name: string;
    nameBn: string | null;
    rollNumber: number;
  };

  type GuardianRow = {
    studentId: string;
    guardianName: string;
    phoneNumber: string;
    smsOptOut: boolean;
  };

  const studentMap = new Map<string, StudentRow>(studentRows.map((s: any) => [s.studentId, s]));

  // Fetch Primary Guardians
  const guardianRows = await client
    .select({
      studentId: studentGuardians.studentId,
      guardianName: guardians.name,
      phoneNumber: guardians.phoneNumber,
      smsOptOut: guardians.smsOptOut,
    })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(
      and(
        eq(guardians.schoolId, schoolId),
        eq(studentGuardians.isPrimary, true),
        inArray(studentGuardians.studentId, studentIds)
      )
    );

  const guardianMap = new Map<string, GuardianRow>(guardianRows.map((g: any) => [g.studentId, g]));

  // Fetch School Custom Template or fallback to system default
  const prefLang = school?.preferredLanguage || 'bn';
  const customTemplates = await client
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.schoolId, schoolId),
        eq(notificationTemplates.templateCode, 'ABSENCE'),
        eq(notificationTemplates.language, prefLang)
      )
    );

  const templateObj = customTemplates[0] || (prefLang === 'en' ? DEFAULT_TEMPLATES.en : DEFAULT_TEMPLATES.bn);

  const createdJobs = [];

  for (const record of absentRecords) {
    const st = studentMap.get(record.studentId);
    const g = guardianMap.get(record.studentId);

    const recipientPhone = g?.phoneNumber ? g.phoneNumber.trim() : '';

    // Handle Missing Guardian Phone
    if (!recipientPhone) {
      const [job] = await client
        .insert(notificationJobs)
        .values({
          schoolId,
          attendanceSessionId,
          studentId: record.studentId,
          recipientPhone: 'MISSING',
          language: prefLang,
          messageBody: 'MISSING_GUARDIAN_PHONE',
          status: 'PERMANENT_FAILURE',
          notificationType: 'ABSENCE',
          finalizedAttendanceVersion: finalizedVersion,
          failureReason: 'MISSING_GUARDIAN_PHONE',
        })
        .onConflictDoNothing()
        .returning();

      if (job) createdJobs.push(job);
      continue;
    }

    // Handle Guardian Opt-Out
    if (g?.smsOptOut) {
      const [job] = await client
        .insert(notificationJobs)
        .values({
          schoolId,
          attendanceSessionId,
          studentId: record.studentId,
          recipientPhone,
          language: prefLang,
          messageBody: 'GUARDIAN_OPTED_OUT',
          status: 'CANCELLED',
          notificationType: 'ABSENCE',
          finalizedAttendanceVersion: finalizedVersion,
          failureReason: 'GUARDIAN_OPTED_OUT',
        })
        .onConflictDoNothing()
        .returning();

      if (job) createdJobs.push(job);
      continue;
    }

    // Handle Allowlist Filtering in Pre-Production
    if (smsSettings.allowlistEnabled) {
      const allowlist = (smsSettings.allowlist as string[]) || [];
      const cleanPhone = recipientPhone.replace(/\s+/g, '');
      const isAllowed = allowlist.some((num) => num.replace(/\s+/g, '') === cleanPhone);

      if (!isAllowed) {
        const [job] = await client
          .insert(notificationJobs)
          .values({
            schoolId,
            attendanceSessionId,
            studentId: record.studentId,
            recipientPhone,
            language: prefLang,
            messageBody: 'PHONE_NOT_IN_ALLOWLIST',
            status: 'CANCELLED',
            notificationType: 'ABSENCE',
            finalizedAttendanceVersion: finalizedVersion,
            failureReason: 'PHONE_NOT_IN_ALLOWLIST',
          })
          .onConflictDoNothing()
          .returning();

        if (job) createdJobs.push(job);
        continue;
      }
    }

    // Render message body
    const messageBody = renderTemplate(templateObj.content, {
      studentName: st?.name || 'Student',
      studentNameBn: st?.nameBn || st?.name || 'শিক্ষার্থী',
      rollNumber: st?.rollNumber ? String(st.rollNumber) : '-',
      className: classSec?.className || '',
      sectionName: classSec?.sectionName || '',
      schoolName: school?.name || 'School',
      date: session.sessionDate,
    });

    // Insert job into database with idempotency uniqueness rule
    const [job] = await client
      .insert(notificationJobs)
      .values({
        schoolId,
        attendanceSessionId,
        studentId: record.studentId,
        recipientPhone,
        language: prefLang,
        messageBody,
        status: 'QUEUED',
        notificationType: 'ABSENCE',
        finalizedAttendanceVersion: finalizedVersion,
      })
      .onConflictDoNothing()
      .returning();

    if (job) {
      createdJobs.push(job);
    }
  }

  return {
    status: 'SUCCESS',
    jobsCreated: createdJobs.length,
    jobs: createdJobs,
  };
}

// 5. SMS Usage Report
export async function getSmsUsageReport(schoolId: string, startDate?: string, endDate?: string) {
  let conditions = [eq(notificationJobs.schoolId, schoolId)];

  if (startDate) {
    conditions.push(gte(notificationJobs.queuedAt, new Date(startDate)));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(notificationJobs.queuedAt, end));
  }

  const jobs = await db
    .select()
    .from(notificationJobs)
    .where(and(...conditions));

  let totalQueued = 0;
  let totalSent = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  let totalPermanentFailures = 0;
  let totalCancelled = 0;
  let totalSegmentCount = 0;

  const breakdownByLanguage: Record<string, number> = { bn: 0, en: 0 };

  for (const job of jobs) {
    if (job.status === 'QUEUED') totalQueued++;
    else if (job.status === 'SENT') totalSent++;
    else if (job.status === 'DELIVERED') totalDelivered++;
    else if (job.status === 'FAILED') totalFailed++;
    else if (job.status === 'PERMANENT_FAILURE') totalPermanentFailures++;
    else if (job.status === 'CANCELLED') totalCancelled++;

    if (job.language) {
      breakdownByLanguage[job.language] = (breakdownByLanguage[job.language] || 0) + 1;
    }

    if (job.messageBody && job.status !== 'CANCELLED' && job.messageBody !== 'MISSING_GUARDIAN_PHONE') {
      const segs = estimateSmsSegments(job.messageBody);
      totalSegmentCount += segs.segmentCount;
    }
  }

  const estimatedCostInInr = Math.round(totalSegmentCount * 0.12 * 100) / 100; // ~₹0.12 per DLT SMS segment

  return {
    schoolId,
    totalJobs: jobs.length,
    statusCounts: {
      totalQueued,
      totalSent,
      totalDelivered,
      totalFailed,
      totalPermanentFailures,
      totalCancelled,
    },
    totalSegmentCount,
    estimatedCostInInr,
    breakdownByLanguage,
  };
}
