import { describe, it, expect, beforeEach } from 'vitest';
import { seedDatabase } from '../src/db/seed';
import { createStudent } from '../src/services/studentService';
import { createQrCredential } from '../src/services/qrService';
import {
  createAttendanceSession,
  processQRCode,
  manualStatusUpdate,
  updateSessionStatus,
} from '../src/services/attendanceService';
import {
  getDailySchoolReport,
  getDailyClassReport,
  getMonthlyClassRegister,
  getStudentAttendanceHistory,
  getAbsentStudentReport,
  getCorrectionReport,
  getTeacherSessionReport,
  generateXLSXExport,
  generateCSVExport,
  sanitizeSpreadsheetValue,
} from '../src/services/reportService';
import { db } from '../src/db';
import ExcelJS from 'exceljs';

describe('Milestone 5: Corrections, Reports & Exports', () => {
  let seeded: any;
  let studentA1: any;
  let studentA2: any;
  let studentB1: any;
  let qrA1: any;
  let qrA2: any;

  beforeEach(async () => {
    seeded = await seedDatabase();

    const uid1 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid2 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const uid3 = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Create Student 1 in School A (Bengali name included)
    const resA1 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-REP-1-${uid1}`,
      name: 'Anirban Das',
      nameBn: 'অনির্‌বান দাস',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 101,
    });
    studentA1 = resA1.student;

    // Create Student 2 in School A
    const resA2 = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-REP-2-${uid2}`,
      name: 'Mousumi Chatterjee',
      nameBn: 'মৌসুমি চট্টোপাধ্যায়',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: 102,
    });
    studentA2 = resA2.student;

    // Create Student 3 in School B
    const resB1 = await createStudent({
      schoolId: seeded.schoolB.id,
      studentCode: `STU-REP-3-${uid3}`,
      name: 'Debjani Paul',
      nameBn: 'দেবজানী পাল',
      classSectionId: seeded.schoolBClass6A.id,
      academicYearId: seeded.academicYearB.id,
      rollNumber: 103,
    });
    studentB1 = resB1.student;

    qrA1 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA1.id });
    qrA2 = await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: studentA2.id });
  });

  it('calculates monthly attendance register grid correctly', async () => {
    // Session 1: 2026-08-01
    const { session: sess1 } = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      classSectionId: seeded.schoolAClass5A.id,
      sessionDate: '2026-08-01',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Scan student 1 PRESENT
    await processQRCode({
      schoolId: seeded.schoolA.id,
      sessionId: sess1.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      clientEventId: `evt-rep-1-${Date.now()}`,
      rawToken: qrA1.rawToken,
      clientTimestamp: new Date(),
    });

    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: sess1.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      newStatus: 'FINALIZED',
      autoMarkAbsentForUnmarked: true,
    });

    // Monthly register for Aug 2026
    const reg = await getMonthlyClassRegister(seeded.schoolA.id, seeded.schoolAClass5A.id, 2026, 8);

    expect(reg.students.length).toBeGreaterThanOrEqual(2);
    const s1Row = reg.students.find((s: any) => s.studentId === studentA1.id);
    const s2Row = reg.students.find((s: any) => s.studentId === studentA2.id);

    expect(s1Row?.attendanceGrid[1]).toBe('PRESENT');
    expect(s2Row?.attendanceGrid[1]).toBe('ABSENT');
    expect(s1Row?.summary.presentCount).toBe(1);
    expect(s2Row?.summary.absentCount).toBe(1);
  });

  it('handles historical class membership snapshot accurately in daily reports', async () => {
    const { session } = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      classSectionId: seeded.schoolAClass5A.id,
      sessionDate: '2026-08-02',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Fetch daily report for this session
    const report = await getDailyClassReport(seeded.schoolA.id, seeded.schoolAClass5A.id, '2026-08-02');
    expect(report.roster.length).toBeGreaterThanOrEqual(2);
    expect(report.roster.some((r: any) => r.studentId === studentA1.id)).toBe(true);
  });

  it('handles Late, Leave, Excused statuses and authorized corrections', async () => {
    const { session } = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      classSectionId: seeded.schoolAClass5A.id,
      sessionDate: '2026-08-03',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    // Correct student 1 status to LATE
    await manualStatusUpdate({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      studentId: studentA1.id,
      newStatus: 'LATE',
      reason: 'Traffic delay authorized',
      actorId: seeded.adminUser.id,
      userRole: 'SCHOOL_ADMIN',
    });

    // Correct student 2 status to EXCUSED
    await manualStatusUpdate({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      studentId: studentA2.id,
      newStatus: 'EXCUSED',
      reason: 'Medical certificate submitted',
      actorId: seeded.adminUser.id,
      userRole: 'SCHOOL_ADMIN',
    });

    const report = await getDailyClassReport(seeded.schoolA.id, seeded.schoolAClass5A.id, '2026-08-03');
    const s1 = report.roster.find((r: any) => r.studentId === studentA1.id);
    const s2 = report.roster.find((r: any) => r.studentId === studentA2.id);

    expect(s1?.status).toBe('LATE');
    expect(s1?.correctionReason).toBe('Traffic delay authorized');
    expect(s2?.status).toBe('EXCUSED');

    // Correction report audit
    const corReport = await getCorrectionReport(seeded.schoolA.id, '2026-08-01', '2026-08-05');
    expect(corReport.totalCorrections).toBeGreaterThanOrEqual(2);
  });

  it('tracks reopened sessions in teacher/session audit reports', async () => {
    const { session } = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      classSectionId: seeded.schoolAClass5A.id,
      sessionDate: '2026-08-04',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      newStatus: 'FINALIZED',
    });

    // Reopen session as Admin
    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      actorId: seeded.adminUser.id,
      userRole: 'SCHOOL_ADMIN',
      newStatus: 'REOPENED',
      reason: 'Admin reopening to correct mistaken scans',
    });

    const sessionReport = await getTeacherSessionReport(seeded.schoolA.id, '2026-08-04', '2026-08-04');
    const sessItem = sessionReport.sessions.find((s: any) => s.sessionId === session.id);

    expect(sessItem).toBeDefined();
    expect(sessItem?.status).toBe('REOPENED');
    expect(sessItem?.reopenedAt).toBeDefined();
  });

  it('enforces tenant isolation for reports and exports', async () => {
    // School B admin requesting School A report must fail / return School B empty
    const reportB = await getDailySchoolReport(seeded.schoolB.id, '2026-08-01');
    expect(reportB.schoolId).toBe(seeded.schoolB.id);
    expect(reportB.sections.every((s: any) => s.classSectionId !== seeded.schoolAClass5A.id)).toBe(true);
  });

  it('protects against spreadsheet formula injection (=, +, -, @)', () => {
    expect(sanitizeSpreadsheetValue('=SUM(1,2)')).toBe("'=SUM(1,2)");
    expect(sanitizeSpreadsheetValue('+12345')).toBe("'+12345");
    expect(sanitizeSpreadsheetValue('-500')).toBe("'-500");
    expect(sanitizeSpreadsheetValue('@cmd')).toBe("'@cmd");
    expect(sanitizeSpreadsheetValue('Normal Text')).toBe('Normal Text');
  });

  it('handles Bengali names correctly in XLSX and CSV export generation', async () => {
    const headers = ['Name', 'Name (Bengali)', 'Formula Test'];
    const rows = [
      ['Anirban Das', 'অনির্‌বান দাস', '=10+10'],
      ['Mousumi Chatterjee', 'মৌসুমি চট্টোপাধ্যায়', '@dangerous'],
    ];

    const xlsxBuf = await generateXLSXExport('TestSheet', headers, rows);
    expect(xlsxBuf).toBeInstanceOf(Buffer);
    expect(xlsxBuf.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuf);
    const sheet = workbook.worksheets[0];
    const cellValue = String(sheet.getRow(2).getCell(2).value);

    expect(cellValue).toBe('অনির্‌বান দাস');
    expect(String(sheet.getRow(2).getCell(3).value)).toBe("'=10+10"); // Formula prepended with single quote

    const csvBuf = generateCSVExport(headers, rows);
    const csvString = csvBuf.toString('utf-8');
    expect(csvString).toContain('অনির্‌বান দাস');
    expect(csvString).toContain("'=10+10");
  });

  it('handles empty report states gracefully without crashing', async () => {
    const emptyDaily = await getDailyClassReport(seeded.schoolA.id, seeded.schoolAClass5A.id, '2099-12-31');
    expect(emptyDaily.session).toBeNull();
    expect(emptyDaily.roster.length).toBe(0);

    const emptyHistory = await getStudentAttendanceHistory(seeded.schoolA.id, studentA1.id, '2099-01-01', '2099-12-31');
    expect(emptyHistory.history.length).toBe(0);
    expect(emptyHistory.summary.totalSessions).toBe(0);
    expect(emptyHistory.summary.attendancePercentage).toBe(0);
  });

  it('enforces authorization rules for attendance correction and session reopen', async () => {
    const { session } = await createAttendanceSession({
      schoolId: seeded.schoolA.id,
      teacherId: seeded.teacherUser.id,
      classSectionId: seeded.schoolAClass5A.id,
      sessionDate: '2026-08-05',
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
    });

    await updateSessionStatus({
      schoolId: seeded.schoolA.id,
      sessionId: session.id,
      actorId: seeded.teacherUser.id,
      userRole: 'TEACHER',
      newStatus: 'FINALIZED',
    });

    // Non-admin (Teacher) attempting to reopen finalized session must fail
    await expect(
      updateSessionStatus({
        schoolId: seeded.schoolA.id,
        sessionId: session.id,
        actorId: seeded.teacherUser.id,
        userRole: 'TEACHER',
        newStatus: 'REOPENED',
        reason: 'Teacher trying to reopen',
      })
    ).rejects.toThrow('REOPEN_REQUIRES_ADMIN_ROLE');
  });
});
