import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import { seedDatabase } from '../src/db/seed';
import { db } from '../src/db';
import { schools, classSections, students, enrollments, attendanceSessions, attendanceRecords } from '../src/db/schema';
import {
  populateDefaultWestBengalHolidays,
  getCalendarDays,
  getWorkingDaysMap,
  upsertCalendarDay,
  bulkSetDateRange,
} from '../src/services/calendarService';
import { validateReportScope } from '../src/services/reportValidationService';
import {
  createReportDraft,
  approveReportInternally,
  recordReportExport,
  getReportHistory,
} from '../src/services/reportApprovalService';
import {
  buildGovernmentReadyExcelWorkbook,
  buildSecureCSVExport,
  sanitizeSpreadsheetValue,
  sanitizeSheetName,
  generateSafeExportFilename,
} from '../src/services/excelExportService';
import { generateGovernmentReadyReportData } from '../src/services/reportService';
import { createStudent } from '../src/services/studentService';

describe('Government-Ready Reporting & Excel Export Suite (10/10 Verification)', () => {
  let seeded: any;

  beforeEach(async () => {
    seeded = await seedDatabase();
  });

  describe('1. Academic Calendar & Working-Day Logic', () => {
    it('populates West Bengal gazetted holidays and excludes them from working days', async () => {
      const year = 2026;
      const { importedCount } = await populateDefaultWestBengalHolidays(seeded.schoolA.id, year);
      expect(importedCount).toBeGreaterThanOrEqual(20);

      const days = await getCalendarDays(seeded.schoolA.id, `${year}-01-01`, `${year}-12-31`);
      expect(days.length).toBeGreaterThanOrEqual(20);

      // Verify Republic Day (Jan 26) is a government holiday and not a working day
      const repDay = days.find((d) => d.calendarDate === '2026-01-26');
      expect(repDay).toBeDefined();
      expect(repDay?.classification).toBe('GOVERNMENT_HOLIDAY');
      expect(repDay?.isWorkingDay).toBe(false);

      // Verify Independence Day (Aug 15)
      const indDay = days.find((d) => d.calendarDate === '2026-08-15');
      expect(indDay).toBeDefined();
      expect(indDay?.classification).toBe('GOVERNMENT_HOLIDAY');
      expect(indDay?.isWorkingDay).toBe(false);
    });

    it('classifies unconfigured Sundays as non-working weekends and weekdays as working days', async () => {
      // 2026-08-02 is Sunday, 2026-08-03 is Monday
      const workingMap = await getWorkingDaysMap(seeded.schoolA.id, '2026-08-01', '2026-08-07');

      const sunday = workingMap.get('2026-08-02');
      expect(sunday).toBeDefined();
      expect(sunday?.isWorkingDay).toBe(false);
      expect(sunday?.classification).toBe('SUNDAY_WEEKEND');

      const monday = workingMap.get('2026-08-03');
      expect(monday).toBeDefined();
      expect(monday?.isWorkingDay).toBe(true);
      expect(monday?.classification).toBe('WORKING_DAY');
    });

    it('supports bulk date range vacations (e.g. Durga Puja Vacation)', async () => {
      const { count } = await bulkSetDateRange(seeded.schoolA.id, {
        startDate: '2026-10-18',
        endDate: '2026-10-25',
        classification: 'VACATION',
        reason: 'Durga Puja Vacation',
        isWorkingDay: false,
      });

      expect(count).toBe(8);

      const days = await getCalendarDays(seeded.schoolA.id, '2026-10-18', '2026-10-25');
      expect(days.length).toBe(8);
      for (const d of days) {
        expect(d.classification).toBe('VACATION');
        expect(d.isWorkingDay).toBe(false);
        expect(d.reason).toBe('Durga Puja Vacation');
      }
    });
  });

  describe('2. Pre-flight Validation & Reconciliation Engine', () => {
    it('blocks export when date range is inverted (start date after end date)', async () => {
      const result = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'ALL_CLASSES',
        startDate: '2026-08-31',
        endDate: '2026-08-01',
      });

      expect(result.isValid).toBe(false);
      expect(result.canExport).toBe(false);
      expect(result.blockingErrors.some((e) => e.code === 'INVALID_DATE_RANGE')).toBe(true);
    });

    it('blocks export when cross-school class section is requested', async () => {
      const result = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'SELECTED_CLASSES',
        classSectionIds: [seeded.schoolBClass6A.id], // School B section in School A context
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.isValid).toBe(false);
      expect(result.blockingErrors.some((e) => e.code === 'CROSS_SCHOOL_CLASS_DETECTED')).toBe(true);
    });

    it('flags warning when students are missing Banglar Shiksha IDs', async () => {
      // Create student without Banglar Shiksha ID
      await createStudent({
        schoolId: seeded.schoolA.id,
        studentCode: `STU-NO-BS-${Date.now()}`,
        name: 'Sourav Ganguly',
        nameBn: 'সৌরভ গাঙ্গুলী',
        classSectionId: seeded.schoolAClass5A.id,
        academicYearId: seeded.academicYearA.id,
        rollNumber: 888,
      });

      const result = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'SELECTED_CLASSES',
        classSectionIds: [seeded.schoolAClass5A.id],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.warnings.some((w) => w.code === 'MISSING_BANGLAR_SHIKSHA_ID')).toBe(true);
      expect(result.summary.missingBanglarShikshaCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Multi-Sheet ExcelJS Generation & Structural Round-Trip', () => {
    it('generates multi-sheet workbook and verifies structure on re-opening', async () => {
      // Create sample students with Bengali names and Banglar Shiksha IDs
      await createStudent({
        schoolId: seeded.schoolA.id,
        studentCode: `STU-XL-1-${Date.now()}`,
        banglarShikshaId: 'BS-2026-WB-99901',
        name: 'Anirban Das',
        nameBn: 'অনির্‌বান দাস',
        classSectionId: seeded.schoolAClass5A.id,
        academicYearId: seeded.academicYearA.id,
        rollNumber: 1,
      });

      await createStudent({
        schoolId: seeded.schoolA.id,
        studentCode: `STU-XL-2-${Date.now()}`,
        banglarShikshaId: 'BS-2026-WB-99902',
        name: 'Mousumi Chatterjee',
        nameBn: 'মৌসুমি চট্টোপাধ্যায়',
        classSectionId: seeded.schoolAClass5A.id,
        academicYearId: seeded.academicYearA.id,
        rollNumber: 2,
      });

      // Populate holidays
      await populateDefaultWestBengalHolidays(seeded.schoolA.id, 2026);

      const reportPayload = await generateGovernmentReadyReportData({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'ALL_CLASSES',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        reportVersion: 1,
        profileVersion: 'West Bengal Management Register v1.0.0',
        internalApprovalStatus: 'APPROVED_INTERNALLY',
      });

      const buffer = await buildGovernmentReadyExcelWorkbook(reportPayload);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(5000);

      // Re-open buffer with ExcelJS and structurally verify
      const reopened = new ExcelJS.Workbook();
      await reopened.xlsx.load(buffer);

      // 1. Assert Sheet Existence
      const sheetNames = reopened.worksheets.map((ws) => ws.name);
      expect(sheetNames).toContain('Cover & Certification');
      expect(sheetNames).toContain('School Summary');
      expect(sheetNames.some((n) => n.startsWith('Class '))).toBe(true);
      expect(sheetNames).toContain('Academic Calendar');
      expect(sheetNames).toContain('Export Metadata');

      // 2. Assert Cover Sheet Metadata
      const cover = reopened.getWorksheet('Cover & Certification');
      expect(cover).toBeDefined();
      const title = cover?.getCell('B2').value;
      expect(title).toBe('GOVERNMENT-READY ATTENDANCE REGISTER');

      // Verify disclaimer text exists
      let hasDisclaimer = false;
      cover?.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'string' && cell.value.includes('DISCLAIMER:')) {
            hasDisclaimer = true;
          }
        });
      });
      expect(hasDisclaimer).toBe(true);

      // 3. Assert Register Sheet Columns & Data
      const regSheet = reopened.worksheets.find((ws) => ws.name.startsWith('Class '));
      expect(regSheet).toBeDefined();

      const headerRow = regSheet?.getRow(1);
      expect(headerRow?.getCell(1).value).toBe('Roll');
      expect(headerRow?.getCell(2).value).toBe('Student ID');
      expect(headerRow?.getCell(3).value).toBe('Banglar Shiksha ID');
      expect(headerRow?.getCell(4).value).toBe('Student Name (EN)');
      expect(headerRow?.getCell(5).value).toBe('Student Name (BN)');

      // Verify Bengali characters survive round-trip
      let foundBengaliName = false;
      regSheet?.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'string' && (cell.value.includes('অনির্‌বান') || cell.value.includes('মৌসুমি'))) {
            foundBengaliName = true;
          }
        });
      });
      expect(foundBengaliName).toBe(true);
    });

    it('sanitizes spreadsheet formula injection (=, +, -, @, tab, cr)', async () => {
      expect(sanitizeSpreadsheetValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeSpreadsheetValue('+12345')).toBe("'+12345");
      expect(sanitizeSpreadsheetValue('-calc')).toBe("'-calc");
      expect(sanitizeSpreadsheetValue('@import')).toBe("'@import");
      expect(sanitizeSpreadsheetValue('\tmalicious')).toBe("'\tmalicious");
      expect(sanitizeSpreadsheetValue('Safe Student Name')).toBe('Safe Student Name');
      expect(sanitizeSpreadsheetValue(100)).toBe(100);
    });

    it('sanitizes sheet names within 31-character limit and deduplicates', () => {
      const set = new Set<string>();
      const n1 = sanitizeSheetName('Class 5 - Section A (Special)', set);
      const n2 = sanitizeSheetName('Class 5 - Section A (Special)', set);
      const n3 = sanitizeSheetName('Class 5 - Section A (Special)', set);

      expect(n1.length).toBeLessThanOrEqual(31);
      expect(n2.length).toBeLessThanOrEqual(31);
      expect(n3.length).toBeLessThanOrEqual(31);
      expect(n1).not.toBe(n2);
      expect(n2).not.toBe(n3);
    });

    it('generates predictable and sanitized export filenames', () => {
      const filename = generateSafeExportFilename({
        udiseCode: '19180100101',
        scope: 'all_classes',
        period: '2026-08',
        reportVersion: 1,
        format: 'xlsx',
      });

      expect(filename).toMatch(/^Attendance_19180100101_all_classes_2026-08_\d{4}-\d{2}-\d{2}_v1\.xlsx$/);
    });
  });

  describe('4. Secure CSV Export', () => {
    it('generates RFC 4180 CSV with UTF-8 BOM for Bengali Excel compatibility', () => {
      const headers = ['Roll', 'Name', 'Name (Bengali)', 'Status'];
      const rows = [
        [1, 'Tanmoy Roy', 'তন্ময় রায়', 'PRESENT'],
        [2, '=HYPERLINK("http://evil.com")', 'দেবব্রত সেন', 'ABSENT'],
      ];

      const csvBuf = buildSecureCSVExport(headers, rows);
      const csvStr = csvBuf.toString('utf-8');

      // Assert BOM (\uFEFF) at index 0
      expect(csvStr.startsWith('\uFEFF')).toBe(true);

      // Assert formula injection is escaped with '
      expect(csvStr).toContain("'=HYPERLINK");

      // Assert Bengali Unicode survives intact
      expect(csvStr).toContain('তন্ময় রায়');
      expect(csvStr).toContain('দেবব্রত সেন');
    });
  });

  describe('5. Internal Management Approval & SHA-256 Checksum Workflow', () => {
    it('creates versioned report draft, computes SHA-256 hash, and approves internally', async () => {
      // 1. Create Draft
      const { report, validationResult } = await createReportDraft({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'ALL_CLASSES',
        periodType: 'MONTHLY',
        periodStartDate: '2026-08-01',
        periodEndDate: '2026-08-31',
        actorId: seeded.schoolAdminUser.id,
      });

      expect(report.id).toBeDefined();
      expect(report.reportVersion).toBe(1);
      expect(['VALIDATED', 'READY_FOR_REVIEW']).toContain(report.status);

      // 2. Export & Record SHA-256 Hash
      const testBuffer = Buffer.from('TEST_EXCEL_STREAM_PAYLOAD_FOR_HASHING');
      const { report: exportedReport, hash } = await recordReportExport({
        schoolId: seeded.schoolA.id,
        reportId: report.id,
        fileBuffer: testBuffer,
        actorId: seeded.schoolAdminUser.id,
      });

      const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
      expect(hash).toBe(expectedHash);
      expect(exportedReport.fileHashSha256).toBe(expectedHash);
      expect(exportedReport.downloadCount).toBe(1);

      // 3. Approve Internally
      const approved = await approveReportInternally({
        schoolId: seeded.schoolA.id,
        reportId: report.id,
        actorId: seeded.schoolAdminUser.id,
        userRole: 'SCHOOL_ADMIN',
      });

      expect(approved.status).toBe('APPROVED_INTERNALLY');
      expect(approved.approvedBy).toBe(seeded.schoolAdminUser.id);
      expect(approved.approvedAt).toBeDefined();

      // 4. View Report History
      const history = await getReportHistory(seeded.schoolA.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].id).toBe(report.id);
    });

    it('rejects internal approval attempt from unauthorized teacher role', async () => {
      const { report } = await createReportDraft({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'ALL_CLASSES',
        periodType: 'MONTHLY',
        periodStartDate: '2026-08-01',
        periodEndDate: '2026-08-31',
      });

      await expect(
        approveReportInternally({
          schoolId: seeded.schoolA.id,
          reportId: report.id,
          actorId: seeded.teacherUser.id,
          userRole: 'TEACHER',
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('6. Tenant Isolation & Security Boundary Verification', () => {
    it('prevents School A from accessing or exporting School B reports', async () => {
      // Create report in School B
      const { report: reportB } = await createReportDraft({
        schoolId: seeded.schoolB.id,
        reportType: 'monthly-register',
        scopeType: 'ALL_CLASSES',
        periodType: 'MONTHLY',
        periodStartDate: '2026-08-01',
        periodEndDate: '2026-08-31',
      });

      // Try to approve School B's report using School A context
      await expect(
        approveReportInternally({
          schoolId: seeded.schoolA.id,
          reportId: reportB.id,
          actorId: seeded.schoolAdminUser.id,
          userRole: 'SCHOOL_ADMIN',
        })
      ).rejects.toThrow(/not found/i);
    });
  });
});
