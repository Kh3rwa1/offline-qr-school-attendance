import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  academicYears,
  attendanceCorrections,
  attendanceRecords,
  attendanceSessions,
  classSections,
  enrollments,
  schools,
  students,
} from '../db/schema';
import { getCalendarCoverageStatus, getWorkingDaysMap } from './calendarService';
import { assertReportGenerationBounds } from './reportGenerationQueue';

export type ReportScopeType =
  | 'WHOLE_SCHOOL'
  | 'ALL_CLASSES'
  | 'SELECTED_CLASSES'
  | 'SELECTED_SECTION'
  | 'SELECTED_STUDENTS'
  | 'ONE_STUDENT';
export type ReportLocale = 'en' | 'bn' | 'hi';

export interface ValidationItem {
  code: string;
  messageKey: string;
  message: string;
  severity: 'BLOCKING' | 'WARNING';
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  link?: string;
}

export interface ResolvedReportScope {
  classSectionIds: string[];
  studentIds: string[];
  totalClasses: number;
  totalStudents: number;
}

export interface ValidationReportResult {
  isValid: boolean;
  canExport: boolean;
  blockingErrors: ValidationItem[];
  warnings: ValidationItem[];
  resolvedScope: ResolvedReportScope;
  summary: {
    totalStudents: number;
    totalClasses: number;
    workingDays: number;
    totalSessions: number;
    finalizedSessions: number;
    pendingSessions: number;
    missingBanglarShikshaCount: number;
    missingBengaliNameCount: number;
    duplicateRollCount: number;
    unmarkedCount: number;
    correctionsCount: number;
    estimatedCells: number;
  };
}

const translations: Record<string, Record<ReportLocale, string>> = {
  SCHOOL_NOT_FOUND: {
    en: 'The active school could not be found.',
    bn: 'সক্রিয় বিদ্যালয়টি পাওয়া যায়নি।',
    hi: 'सक्रिय विद्यालय नहीं मिला।',
  },
  MISSING_UDISE_CODE: {
    en: 'The school profile has no UDISE code.',
    bn: 'বিদ্যালয়ের প্রোফাইলে UDISE কোড নেই।',
    hi: 'विद्यालय प्रोफ़ाइल में UDISE कोड नहीं है।',
  },
  INVALID_DATE_FORMAT: {
    en: 'Enter valid start and end dates.',
    bn: 'সঠিক শুরুর ও শেষের তারিখ লিখুন।',
    hi: 'सही आरंभ और समाप्ति तिथि दर्ज करें।',
  },
  INVALID_DATE_RANGE: {
    en: 'The start date must not be after the end date.',
    bn: 'শুরুর তারিখ শেষের তারিখের পরে হতে পারে না।',
    hi: 'आरंभ तिथि समाप्ति तिथि के बाद नहीं हो सकती।',
  },
  EMPTY_CLASS_SCOPE: {
    en: 'Choose at least one class or section.',
    bn: 'কমপক্ষে একটি শ্রেণি বা বিভাগ নির্বাচন করুন।',
    hi: 'कम से कम एक कक्षा या अनुभाग चुनें।',
  },
  EMPTY_STUDENT_SCOPE: {
    en: 'Choose at least one enrolled student.',
    bn: 'কমপক্ষে একজন নথিভুক্ত শিক্ষার্থী নির্বাচন করুন।',
    hi: 'कम से कम एक नामांकित विद्यार्थी चुनें।',
  },
  ONE_STUDENT_SCOPE_REQUIRES_ONE: {
    en: 'A one-student report must contain exactly one student.',
    bn: 'একজন শিক্ষার্থীর রিপোর্টে ঠিক একজন শিক্ষার্থী থাকতে হবে।',
    hi: 'एक-विद्यार्थी रिपोर्ट में ठीक एक विद्यार्थी होना चाहिए।',
  },
  SELECTED_SECTION_REQUIRES_ONE: {
    en: 'Choose exactly one section for this report.',
    bn: 'এই রিপোর্টের জন্য ঠিক একটি বিভাগ নির্বাচন করুন।',
    hi: 'इस रिपोर्ट के लिए ठीक एक अनुभाग चुनें।',
  },
  CROSS_SCHOOL_CLASS_DETECTED: {
    en: 'A selected class is missing or belongs to another school.',
    bn: 'নির্বাচিত একটি শ্রেণি নেই বা অন্য বিদ্যালয়ের।',
    hi: 'चुनी गई कोई कक्षा उपलब्ध नहीं है या दूसरे विद्यालय की है।',
  },
  CROSS_SCHOOL_STUDENT_DETECTED: {
    en: 'A selected student is missing, inactive, or belongs to another school.',
    bn: 'নির্বাচিত একজন শিক্ষার্থী নেই, নিষ্ক্রিয়, বা অন্য বিদ্যালয়ের।',
    hi: 'चुना गया कोई विद्यार्थी उपलब्ध नहीं, निष्क्रिय या दूसरे विद्यालय का है।',
  },
  TEACHER_SCOPE_FORBIDDEN: {
    en: 'This report includes a class outside the teacher’s active assignment.',
    bn: 'এই রিপোর্টে শিক্ষকের সক্রিয় দায়িত্বের বাইরের শ্রেণি রয়েছে।',
    hi: 'इस रिपोर्ट में शिक्षक के सक्रिय दायित्व से बाहर की कक्षा है।',
  },
  NO_STUDENTS_IN_SCOPE: {
    en: 'No active enrolled students exist in the selected scope.',
    bn: 'নির্বাচিত পরিসরে কোনো সক্রিয় নথিভুক্ত শিক্ষার্থী নেই।',
    hi: 'चुने गए दायरे में कोई सक्रिय नामांकित विद्यार्थी नहीं है।',
  },
  DUPLICATE_ROLL_NUMBER: {
    en: 'Duplicate roll numbers exist in a selected section.',
    bn: 'নির্বাচিত বিভাগে একই রোল নম্বর একাধিকবার রয়েছে।',
    hi: 'चुने गए अनुभाग में एक ही रोल नंबर दोहराया गया है।',
  },
  MISSING_BANGLAR_SHIKSHA_ID: {
    en: 'Some students have no Banglar Shiksha ID.',
    bn: 'কিছু শিক্ষার্থীর বাংলার শিক্ষা আইডি নেই।',
    hi: 'कुछ विद्यार्थियों की बांग्लार शिक्षा आईडी नहीं है।',
  },
  MISSING_BENGALI_NAME: {
    en: 'Some students have no Bengali name.',
    bn: 'কিছু শিক্ষার্থীর বাংলা নাম নেই।',
    hi: 'कुछ विद्यार्थियों का बंगाली नाम नहीं है।',
  },
  MISSING_APPROVED_CALENDAR: {
    en: 'No approved academic calendar covers every year in this period; weekday/Sunday defaults will be used and the report will carry this warning.',
    bn: 'এই সময়ের সব বছরের জন্য অনুমোদিত শিক্ষাবর্ষ ক্যালেন্ডার নেই; কর্মদিবস/রবিবারের সাধারণ নিয়ম ব্যবহার হবে এবং রিপোর্টে সতর্কতা থাকবে।',
    hi: 'इस अवधि के हर वर्ष के लिए स्वीकृत शैक्षणिक कैलेंडर नहीं है; कार्यदिवस/रविवार का सामान्य नियम उपयोग होगा और रिपोर्ट में चेतावनी रहेगी।',
  },
  NO_ATTENDANCE_SESSIONS: {
    en: 'No attendance sessions were recorded in the selected period.',
    bn: 'নির্বাচিত সময়ে কোনো হাজিরা সেশন রেকর্ড হয়নি।',
    hi: 'चुनी गई अवधि में कोई उपस्थिति सत्र दर्ज नहीं हुआ।',
  },
  UNFINALIZED_ATTENDANCE_SESSION: {
    en: 'Some attendance sessions are not finalized.',
    bn: 'কিছু হাজিরা সেশন চূড়ান্ত করা হয়নি।',
    hi: 'कुछ उपस्थिति सत्र अंतिम नहीं किए गए हैं।',
  },
  UNMARKED_ATTENDANCE: {
    en: 'Some expected student attendance entries are unmarked.',
    bn: 'কিছু প্রত্যাশিত শিক্ষার্থী হাজিরা চিহ্নিত করা হয়নি।',
    hi: 'कुछ अपेक्षित विद्यार्थी उपस्थिति प्रविष्टियाँ दर्ज नहीं हैं।',
  },
  REPORT_SIZE_LIMIT: {
    en: 'This report is too large for the configured safe export limit. Narrow the date or student scope.',
    bn: 'নিরাপদ এক্সপোর্ট সীমার তুলনায় রিপোর্টটি বড়। তারিখ বা শিক্ষার্থীর পরিসর ছোট করুন।',
    hi: 'यह रिपोर्ट सुरक्षित निर्यात सीमा से बड़ी है। तिथि या विद्यार्थी दायरा छोटा करें।',
  },
};

function localizedItem(
  code: string,
  severity: ValidationItem['severity'],
  locale: ReportLocale,
  extras: Omit<ValidationItem, 'code' | 'messageKey' | 'message' | 'severity'> = {}
): ValidationItem {
  return {
    code,
    messageKey: `report.validation.${code}`,
    message: translations[code]?.[locale] || translations[code]?.en || code,
    severity,
    ...extras,
  };
}

function unique(values: string[] | undefined): string[] {
  return [...new Set((values || []).filter(Boolean))];
}

function emptyResult(blockingErrors: ValidationItem[], warnings: ValidationItem[]): ValidationReportResult {
  return {
    isValid: false,
    canExport: false,
    blockingErrors,
    warnings,
    resolvedScope: { classSectionIds: [], studentIds: [], totalClasses: 0, totalStudents: 0 },
    summary: {
      totalStudents: 0,
      totalClasses: 0,
      workingDays: 0,
      totalSessions: 0,
      finalizedSessions: 0,
      pendingSessions: 0,
      missingBanglarShikshaCount: 0,
      missingBengaliNameCount: 0,
      duplicateRollCount: 0,
      unmarkedCount: 0,
      correctionsCount: 0,
      estimatedCells: 0,
    },
  };
}

export async function validateReportScope(params: {
  schoolId: string;
  reportType: string;
  scopeType: ReportScopeType;
  classSectionIds?: string[];
  studentIds?: string[];
  allowedClassSectionIds?: string[];
  startDate: string;
  endDate: string;
  locale?: ReportLocale;
}): Promise<ValidationReportResult> {
  const locale = params.locale || 'en';
  const blockingErrors: ValidationItem[] = [];
  const warnings: ValidationItem[] = [];

  const [school] = await db.select().from(schools).where(eq(schools.id, params.schoolId)).limit(1);
  if (!school) {
    blockingErrors.push(localizedItem('SCHOOL_NOT_FOUND', 'BLOCKING', locale));
    return emptyResult(blockingErrors, warnings);
  }
  if (!school.udiseCode) {
    warnings.push(localizedItem('MISSING_UDISE_CODE', 'WARNING', locale, {
      entityId: school.id,
      entityType: 'SCHOOL',
      link: '/app/school-admin/settings',
    }));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(params.endDate)) {
    blockingErrors.push(localizedItem('INVALID_DATE_FORMAT', 'BLOCKING', locale));
    return emptyResult(blockingErrors, warnings);
  }
  const start = new Date(`${params.startDate}T00:00:00Z`);
  const end = new Date(`${params.endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    blockingErrors.push(localizedItem('INVALID_DATE_FORMAT', 'BLOCKING', locale));
    return emptyResult(blockingErrors, warnings);
  }
  if (start > end) {
    blockingErrors.push(localizedItem('INVALID_DATE_RANGE', 'BLOCKING', locale));
    return emptyResult(blockingErrors, warnings);
  }

  const requestedClassIds = unique(params.classSectionIds);
  const requestedStudentIds = unique(params.studentIds);
  const studentScope = params.scopeType === 'SELECTED_STUDENTS' || params.scopeType === 'ONE_STUDENT';
  const allClassScope = params.scopeType === 'WHOLE_SCHOOL' || params.scopeType === 'ALL_CLASSES';

  if (params.scopeType === 'ONE_STUDENT' && requestedStudentIds.length !== 1) {
    blockingErrors.push(localizedItem('ONE_STUDENT_SCOPE_REQUIRES_ONE', 'BLOCKING', locale));
  } else if (params.scopeType === 'SELECTED_STUDENTS' && requestedStudentIds.length === 0) {
    blockingErrors.push(localizedItem('EMPTY_STUDENT_SCOPE', 'BLOCKING', locale));
  }
  if (params.scopeType === 'SELECTED_SECTION' && requestedClassIds.length !== 1) {
    blockingErrors.push(localizedItem('SELECTED_SECTION_REQUIRES_ONE', 'BLOCKING', locale));
  } else if (!studentScope && !allClassScope && requestedClassIds.length === 0) {
    blockingErrors.push(localizedItem('EMPTY_CLASS_SCOPE', 'BLOCKING', locale));
  }
  if (blockingErrors.length > 0) return emptyResult(blockingErrors, warnings);

  let targetClassSections: Array<{ id: string }> = [];
  if (allClassScope) {
    targetClassSections = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(eq(classSections.schoolId, params.schoolId));
  } else if (!studentScope) {
    targetClassSections = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.schoolId, params.schoolId), inArray(classSections.id, requestedClassIds)));
    if (targetClassSections.length !== requestedClassIds.length) {
      blockingErrors.push(localizedItem('CROSS_SCHOOL_CLASS_DETECTED', 'BLOCKING', locale));
    }
  }

  let activeEnrollments: Array<{
    enrollmentId: string;
    classSectionId: string;
    studentId: string;
    rollNumber: number;
    studentName: string;
    studentNameBn: string | null;
    banglarShikshaId: string | null;
  }> = [];

  if (studentScope) {
    activeEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        classSectionId: enrollments.classSectionId,
        studentId: enrollments.studentId,
        rollNumber: enrollments.rollNumber,
        studentName: students.name,
        studentNameBn: students.nameBn,
        banglarShikshaId: students.banglarShikshaId,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(classSections, eq(enrollments.classSectionId, classSections.id))
      .where(
        and(
          eq(enrollments.schoolId, params.schoolId),
          eq(students.schoolId, params.schoolId),
          eq(classSections.schoolId, params.schoolId),
          eq(enrollments.status, 'ACTIVE'),
          eq(students.status, 'ACTIVE'),
          inArray(students.id, requestedStudentIds)
        )
      );
    const foundStudentIds = new Set(activeEnrollments.map((row) => row.studentId));
    if (foundStudentIds.size !== requestedStudentIds.length) {
      blockingErrors.push(localizedItem('CROSS_SCHOOL_STUDENT_DETECTED', 'BLOCKING', locale));
    }
    targetClassSections = [...new Set(activeEnrollments.map((row) => row.classSectionId))].map((id) => ({ id }));
  } else if (targetClassSections.length > 0) {
    activeEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        classSectionId: enrollments.classSectionId,
        studentId: enrollments.studentId,
        rollNumber: enrollments.rollNumber,
        studentName: students.name,
        studentNameBn: students.nameBn,
        banglarShikshaId: students.banglarShikshaId,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolId, params.schoolId),
          eq(students.schoolId, params.schoolId),
          eq(enrollments.status, 'ACTIVE'),
          eq(students.status, 'ACTIVE'),
          inArray(enrollments.classSectionId, targetClassSections.map((row) => row.id))
        )
      );
  }

  const targetSectionIds = [...new Set(targetClassSections.map((section) => section.id))];
  const selectedStudentIds = [...new Set(activeEnrollments.map((enrollment) => enrollment.studentId))];
  if (targetSectionIds.length === 0) {
    blockingErrors.push(localizedItem('EMPTY_CLASS_SCOPE', 'BLOCKING', locale));
  }
  if (activeEnrollments.length === 0) {
    blockingErrors.push(localizedItem('NO_STUDENTS_IN_SCOPE', 'BLOCKING', locale));
  }

  if (params.allowedClassSectionIds) {
    const allowed = new Set(params.allowedClassSectionIds);
    if (targetSectionIds.some((id) => !allowed.has(id))) {
      blockingErrors.push(localizedItem('TEACHER_SCOPE_FORBIDDEN', 'BLOCKING', locale));
    }
  }

  const rollsBySection = new Map<string, Set<number>>();
  let duplicateRollCount = 0;
  for (const enrollment of activeEnrollments) {
    const rolls = rollsBySection.get(enrollment.classSectionId) || new Set<number>();
    if (rolls.has(enrollment.rollNumber)) duplicateRollCount += 1;
    rolls.add(enrollment.rollNumber);
    rollsBySection.set(enrollment.classSectionId, rolls);
  }
  if (duplicateRollCount > 0) {
    blockingErrors.push(localizedItem('DUPLICATE_ROLL_NUMBER', 'BLOCKING', locale, {
      details: { count: duplicateRollCount },
      link: '/app/school-admin/students',
    }));
  }

  const missingBanglarShikshaCount = activeEnrollments.filter((row) => !row.banglarShikshaId?.trim()).length;
  const missingBengaliNameCount = activeEnrollments.filter((row) => !row.studentNameBn?.trim()).length;
  if (missingBanglarShikshaCount > 0) {
    warnings.push(localizedItem('MISSING_BANGLAR_SHIKSHA_ID', 'WARNING', locale, {
      details: { count: missingBanglarShikshaCount },
      link: '/app/school-admin/students',
    }));
  }
  if (missingBengaliNameCount > 0) {
    warnings.push(localizedItem('MISSING_BENGALI_NAME', 'WARNING', locale, {
      details: { count: missingBengaliNameCount },
      link: '/app/school-admin/students',
    }));
  }

  const workingDaysMap = await getWorkingDaysMap(params.schoolId, params.startDate, params.endDate);
  const workingDaysCount = [...workingDaysMap.values()].filter((day) => day.isWorkingDay).length;
  const calendarCoverage = await getCalendarCoverageStatus(params.schoolId, params.startDate, params.endDate);
  if (!calendarCoverage.complete) {
    warnings.push(localizedItem('MISSING_APPROVED_CALENDAR', 'WARNING', locale, {
      details: { missingYears: calendarCoverage.missingYears },
      link: '/app/school-admin/settings',
    }));
  }

  let totalSessions = 0;
  let finalizedSessions = 0;
  let pendingSessions = 0;
  let unmarkedCount = 0;
  if (targetSectionIds.length > 0) {
    const sessions = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.schoolId, params.schoolId),
          inArray(attendanceSessions.classSectionId, targetSectionIds),
          gte(attendanceSessions.sessionDate, params.startDate),
          lte(attendanceSessions.sessionDate, params.endDate)
        )
      );
    totalSessions = sessions.length;
    finalizedSessions = sessions.filter((session) => session.status === 'FINALIZED').length;
    pendingSessions = totalSessions - finalizedSessions;

    if (totalSessions === 0) warnings.push(localizedItem('NO_ATTENDANCE_SESSIONS', 'WARNING', locale));
    if (pendingSessions > 0) {
      warnings.push(localizedItem('UNFINALIZED_ATTENDANCE_SESSION', 'WARNING', locale, {
        details: { count: pendingSessions },
        link: '/app/school-admin/attendance',
      }));
    }

    const enrollmentCountBySection = new Map<string, number>();
    for (const enrollment of activeEnrollments) {
      enrollmentCountBySection.set(
        enrollment.classSectionId,
        (enrollmentCountBySection.get(enrollment.classSectionId) || 0) + 1
      );
    }
    const expectedMarks = sessions.reduce(
      (total, session) => total + (enrollmentCountBySection.get(session.classSectionId) || 0),
      0
    );
    const sessionIds = sessions.map((session) => session.id);
    let markedCount = 0;
    if (sessionIds.length > 0) {
      const marked = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, params.schoolId),
            inArray(attendanceRecords.attendanceSessionId, sessionIds),
            sql`${attendanceRecords.status} <> 'UNMARKED'`
          )
        );
      markedCount = Number(marked[0]?.count || 0);
    }
    unmarkedCount = Math.max(0, expectedMarks - markedCount);
    if (unmarkedCount > 0) {
      warnings.push(localizedItem('UNMARKED_ATTENDANCE', 'WARNING', locale, {
        details: { count: unmarkedCount },
        link: '/app/school-admin/attendance',
      }));
    }
  }

  const corrections = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceCorrections)
    .where(
      and(
        eq(attendanceCorrections.schoolId, params.schoolId),
        gte(attendanceCorrections.correctedAt, start),
        lte(attendanceCorrections.correctedAt, new Date(`${params.endDate}T23:59:59.999Z`))
      )
    );
  const correctionsCount = Number(corrections[0]?.count || 0);

  let estimatedCells = 0;
  try {
    estimatedCells = assertReportGenerationBounds({
      periodStart: params.startDate,
      periodEnd: params.endDate,
      studentCount: activeEnrollments.length,
    }).estimatedCells;
  } catch {
    blockingErrors.push(localizedItem('REPORT_SIZE_LIMIT', 'BLOCKING', locale));
  }

  const isValid = blockingErrors.length === 0;
  return {
    isValid,
    canExport: isValid,
    blockingErrors,
    warnings,
    resolvedScope: {
      classSectionIds: targetSectionIds,
      studentIds: studentScope ? selectedStudentIds : [],
      totalClasses: targetSectionIds.length,
      totalStudents: activeEnrollments.length,
    },
    summary: {
      totalStudents: activeEnrollments.length,
      totalClasses: targetSectionIds.length,
      workingDays: workingDaysCount,
      totalSessions,
      finalizedSessions,
      pendingSessions,
      missingBanglarShikshaCount,
      missingBengaliNameCount,
      duplicateRollCount,
      unmarkedCount,
      correctionsCount,
      estimatedCells,
    },
  };
}
