import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { students } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';
import {
  approveCalendarVersion,
  getCalendarDays,
  getDefaultWestBengalHolidays,
  getWorkingDaysMap,
  populateDefaultWestBengalHolidays,
  upsertCalendarDay,
} from '../src/services/calendarService';
import {
  approveReportInternally,
  createReportDraft,
  recordReportArtifact,
  recordReportDownload,
} from '../src/services/reportApprovalService';
import {
  assertReportArtifactContract,
  loadReportArtifact,
  persistReportArtifact,
  REPORT_FORMAT_CONTRACT,
} from '../src/services/reportArtifactService';
import { generateValidatedGovernmentReportData } from '../src/services/governmentReportDataService';
import { buildGovernmentReportArtifact } from '../src/services/governmentReportExportService';
import { assertReportGenerationBounds } from '../src/services/reportGenerationQueue';
import { resolveReportingProfile } from '../src/services/reportProfileService';
import { createStudent } from '../src/services/studentService';
import { validateReportScope } from '../src/services/reportValidationService';

async function createScopedStudent(seeded: any, suffix: string, rollNumber: number) {
  return createStudent({
    schoolId: seeded.schoolA.id,
    studentCode: `REPORT-${suffix}-${Date.now()}-${rollNumber}`,
    banglarShikshaId: `BS-${suffix}-${rollNumber}`,
    name: `Report Student ${suffix}`,
    nameBn: `রিপোর্ট শিক্ষার্থী ${suffix}`,
    classSectionId: seeded.schoolAClass5A.id,
    academicYearId: seeded.academicYearA.id,
    rollNumber,
  });
}

async function validatedDraft(seeded: any, format: 'xlsx' | 'csv' | 'html' = 'xlsx') {
  await createScopedStudent(seeded, format, 700 + ['xlsx', 'csv', 'html'].indexOf(format));
  const validation = await validateReportScope({
    schoolId: seeded.schoolA.id,
    reportType: 'monthly-register',
    scopeType: 'SELECTED_CLASSES',
    classSectionIds: [seeded.schoolAClass5A.id],
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    locale: 'bn',
  });
  expect(validation.isValid).toBe(true);
  const profile = await resolveReportingProfile(seeded.schoolA.id);
  const draft = await createReportDraft({
    schoolId: seeded.schoolA.id,
    reportType: 'monthly-register',
    scopeType: 'SELECTED_CLASSES',
    scopeParameters: { classSectionIds: validation.resolvedScope.classSectionIds },
    periodType: 'MONTHLY',
    periodStartDate: '2026-08-01',
    periodEndDate: '2026-08-31',
    profileSnapshot: profile,
    format,
    locale: 'bn',
    actorId: seeded.schoolAdminUser.id,
    validationResult: validation,
  });
  const generatedAt = draft.report.generatedAt instanceof Date
    ? draft.report.generatedAt.toISOString()
    : new Date('2026-08-31T12:00:00.000Z').toISOString();
  const payload = await generateValidatedGovernmentReportData({
    schoolId: seeded.schoolA.id,
    reportId: draft.report.id,
    reportType: 'monthly-register',
    scopeType: 'SELECTED_CLASSES',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    reportVersion: draft.report.reportVersion,
    profileSnapshot: profile,
    locale: 'bn',
    validationResult: validation,
    generatedAt,
  });
  return { validation, profile, draft, payload };
}

describe('Reporting contract integrity', () => {
  let seeded: any;

  beforeEach(async () => {
    process.env.REPORT_ARTIFACT_STORAGE = 'database';
    seeded = await seedDatabase();
  });

  describe('calendar governance', () => {
    it('keeps imported movable dates inactive until confirmed and approved', async () => {
      const imported = await populateDefaultWestBengalHolidays(seeded.schoolA.id, 2026, seeded.schoolAdminUser.id);
      expect(imported.approximateCount).toBeGreaterThan(0);
      const importedVersion = imported.calendarVersion;
      expect(importedVersion).not.toBeNull();
      if (!importedVersion) throw new Error('CALENDAR_VERSION_NOT_CREATED');
      expect(importedVersion.status).toBe('DRAFT');

      const draft = await getCalendarDays(seeded.schoolA.id, '2026-01-01', '2026-12-31');
      expect(draft.days.length).toBeGreaterThanOrEqual(20);
      expect(draft.days.some((day: any) => day.isApproximate)).toBe(true);

      const beforeApproval = await getWorkingDaysMap(seeded.schoolA.id, '2026-01-26', '2026-01-26');
      expect(beforeApproval.get('2026-01-26')?.isWorkingDay).toBe(true);
      await expect(
        approveCalendarVersion(
          seeded.schoolA.id,
          importedVersion.id,
          seeded.schoolAdminUser.id,
          'West Bengal School Education Department order for 2026'
        )
      ).rejects.toThrow('CALENDAR_APPROXIMATE_DATES_REQUIRE_CONFIRMATION');

      for (const holiday of getDefaultWestBengalHolidays(2026).filter((item) => item.isApproximate)) {
        await upsertCalendarDay(seeded.schoolA.id, {
          calendarDate: holiday.date,
          classification: 'SCHOOL_HOLIDAY',
          reason: holiday.reason.replace(' (proposed date — confirmation required)', ''),
          isWorkingDay: false,
          isApproximate: false,
          sourceType: 'DEPARTMENT_ORDER',
          sourceReference: `Confirmed order date for ${holiday.reason}`,
          createdBy: seeded.schoolAdminUser.id,
        });
      }
      const approved = await approveCalendarVersion(
        seeded.schoolA.id,
        importedVersion.id,
        seeded.schoolAdminUser.id,
        'West Bengal School Education Department order for 2026'
      );
      expect(approved.status).toBe('APPROVED');
      const afterApproval = await getWorkingDaysMap(seeded.schoolA.id, '2026-01-26', '2026-01-26');
      expect(afterApproval.get('2026-01-26')?.isWorkingDay).toBe(false);
    });
  });

  describe('scope and tenant validation', () => {
    it('supports one-student scope without requiring a class selection', async () => {
      const created: any = await createScopedStudent(seeded, 'ONE', 801);
      const result = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'daily-register',
        scopeType: 'ONE_STUDENT',
        studentIds: [created.student.id],
        startDate: '2026-08-01',
        endDate: '2026-08-01',
        locale: 'hi',
      });
      expect(result.isValid).toBe(true);
      expect(result.resolvedScope.studentIds).toEqual([created.student.id]);
      expect(result.resolvedScope.classSectionIds).toContain(seeded.schoolAClass5A.id);
    });

    it('rejects empty scopes and explicit cross-school student references', async () => {
      const empty = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'SELECTED_STUDENTS',
        studentIds: [],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(empty.blockingErrors.some((item) => item.code === 'EMPTY_STUDENT_SCOPE')).toBe(true);

      const schoolBStudent: any = await createStudent({
        schoolId: seeded.schoolB.id,
        studentCode: `REPORT-CROSS-${Date.now()}`,
        name: 'Cross Tenant Student',
        classSectionId: seeded.schoolBClass6A.id,
        academicYearId: seeded.academicYearB.id,
        rollNumber: 901,
      });
      const crossTenant = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'ONE_STUDENT',
        studentIds: [schoolBStudent.student.id],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(crossTenant.blockingErrors.some((item) => item.code === 'CROSS_SCHOOL_STUDENT_DETECTED')).toBe(true);
    });

    it('warns when approved calendar coverage or attendance marks are missing', async () => {
      await createScopedStudent(seeded, 'WARN', 802);
      const result = await validateReportScope({
        schoolId: seeded.schoolA.id,
        reportType: 'monthly-register',
        scopeType: 'SELECTED_CLASSES',
        classSectionIds: [seeded.schoolAClass5A.id],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(result.warnings.some((item) => item.code === 'MISSING_APPROVED_CALENDAR')).toBe(true);
      expect(result.summary.unmarkedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('real format outputs', () => {
    it('creates structurally valid XLSX with Bengali Unicode and applied profile metadata', async () => {
      const { payload } = await validatedDraft(seeded, 'xlsx');
      const artifact = await buildGovernmentReportArtifact(payload, 'xlsx');
      assertReportArtifactContract(artifact);
      expect(artifact.filename.endsWith('.xlsx')).toBe(true);
      expect(artifact.contentType).toBe(REPORT_FORMAT_CONTRACT.xlsx.contentType);
      expect(artifact.content.subarray(0, 2).toString()).toBe('PK');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(artifact.content);
      expect(workbook.worksheets.length).toBeGreaterThanOrEqual(3);
      expect(workbook.worksheets.some((sheet) => sheet.name.includes('হাজিরা'))).toBe(true);
      expect(JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()))).toContain('রিপোর্ট শিক্ষার্থী');
    });

    it('creates UTF-8 CSV with localized headers and formula protection', async () => {
      const { payload } = await validatedDraft(seeded, 'csv');
      const malicious = { ...payload, classRegisters: payload.classRegisters.map((register: any) => ({
        ...register,
        students: register.students.map((student: any, index: number) => index === 0 ? { ...student, name: '=HYPERLINK("https://example.invalid")' } : student),
      })) };
      const artifact = await buildGovernmentReportArtifact(malicious as any, 'csv');
      assertReportArtifactContract(artifact);
      const text = artifact.content.toString('utf8');
      expect(text.startsWith('\uFEFF')).toBe(true);
      expect(text).toContain('শ্রেণি');
      expect(text).toContain("'=HYPERLINK");
    });

    it('creates escaped printable HTML instead of XLSX bytes', async () => {
      const { payload } = await validatedDraft(seeded, 'html');
      const malicious = { ...payload, school: { ...payload.school, name: '<script>unsafe()</script>' } };
      const artifact = await buildGovernmentReportArtifact(malicious as any, 'html');
      assertReportArtifactContract(artifact);
      const text = artifact.content.toString('utf8');
      expect(text.toLowerCase().startsWith('<!doctype html>')).toBe(true);
      expect(text).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
      expect(text).not.toContain('<script>unsafe()</script>');
      expect(artifact.filename.endsWith('.html')).toBe(true);
      expect(artifact.contentType).toBe(REPORT_FORMAT_CONTRACT.html.contentType);
    });

    it('produces distinct report-type tables', async () => {
      const { payload } = await validatedDraft(seeded, 'html');
      const absentee = await buildGovernmentReportArtifact({ ...payload, reportType: 'absentee' } as any, 'html');
      const missing = await buildGovernmentReportArtifact({ ...payload, reportType: 'missing-data' } as any, 'html');
      expect(absentee.content.equals(missing.content)).toBe(false);
      expect(absentee.content.toString()).toContain('absentee');
      expect(missing.content.toString()).toContain('missing-data');
    });
  });

  describe('immutable artifact and lifecycle', () => {
    it('persists exact bytes once, verifies SHA-256 and never regenerates after live-data mutation', async () => {
      const { draft, payload } = await validatedDraft(seeded, 'html');
      const generated = await buildGovernmentReportArtifact(payload, 'html');
      const stored = await persistReportArtifact({ schoolId: seeded.schoolA.id, reportId: draft.report.id, ...generated });
      const ready = await recordReportArtifact({ schoolId: seeded.schoolA.id, reportId: draft.report.id, artifact: stored, actorId: seeded.schoolAdminUser.id });
      expect(ready.status).toBe('READY_FOR_REVIEW');
      const expectedHash = crypto.createHash('sha256').update(generated.content).digest('hex');
      expect(stored.sha256).toBe(expectedHash);

      await db.update(students).set({ name: 'Changed After Export' }).where(and(eq(students.schoolId, seeded.schoolA.id), eq(students.id, payload.classRegisters[0].students[0].studentId)));
      const first = await loadReportArtifact(seeded.schoolA.id, draft.report.id);
      const second = await loadReportArtifact(seeded.schoolA.id, draft.report.id);
      expect(first?.content.equals(generated.content)).toBe(true);
      expect(second?.content.equals(first!.content)).toBe(true);
      expect(first?.sha256).toBe(expectedHash);
      await expect(persistReportArtifact({ schoolId: seeded.schoolA.id, reportId: draft.report.id, ...generated })).rejects.toThrow();
      expect(await loadReportArtifact(seeded.schoolB.id, draft.report.id)).toBeNull();
    });

    it('allows approval only after artifact creation and preserves approval on download', async () => {
      const { draft, payload } = await validatedDraft(seeded, 'csv');
      await expect(approveReportInternally({ schoolId: seeded.schoolA.id, reportId: draft.report.id, actorId: seeded.schoolAdminUser.id, userRole: 'SCHOOL_ADMIN' })).rejects.toThrow('REPORT_APPROVAL_TRANSITION_INVALID');
      const generated = await buildGovernmentReportArtifact(payload, 'csv');
      const stored = await persistReportArtifact({ schoolId: seeded.schoolA.id, reportId: draft.report.id, ...generated });
      await recordReportArtifact({ schoolId: seeded.schoolA.id, reportId: draft.report.id, artifact: stored });
      const approved = await approveReportInternally({ schoolId: seeded.schoolA.id, reportId: draft.report.id, actorId: seeded.schoolAdminUser.id, userRole: 'SCHOOL_ADMIN' });
      expect(approved.status).toBe('APPROVED_INTERNALLY');
      const downloaded = await recordReportDownload({ schoolId: seeded.schoolA.id, reportId: draft.report.id, artifactHash: stored.sha256, actorId: seeded.schoolAdminUser.id });
      expect(downloaded.report.status).toBe('APPROVED_INTERNALLY');
      expect(downloaded.report.downloadCount).toBe(1);
    });
  });

  it('rejects exports beyond configured bounded-generation limits', () => {
    expect(() => assertReportGenerationBounds({ periodStart: '2020-01-01', periodEnd: '2030-12-31', studentCount: 5000 })).toThrow();
  });
});
