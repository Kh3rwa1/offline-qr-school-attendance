import { generateGovernmentReadyReportData } from './reportService';
import { ReportingProfileSnapshot } from './reportProfileService';
import { ReportLocale, ReportScopeType, ValidationReportResult } from './reportValidationService';

export const GOVERNMENT_REPORT_TYPES = [
  'monthly-register',
  'daily-register',
  'daily-school',
  'academic-year',
  'custom-range',
  'absentee',
  'consecutive-absence',
  'corrections',
  'missing-data',
  'complete-package',
] as const;

export type GovernmentReportType = (typeof GOVERNMENT_REPORT_TYPES)[number];

export async function generateValidatedGovernmentReportData(params: {
  schoolId: string;
  reportId: string;
  reportType: GovernmentReportType;
  scopeType: ReportScopeType;
  startDate: string;
  endDate: string;
  reportVersion: number;
  profileSnapshot: ReportingProfileSnapshot;
  locale: ReportLocale;
  validationResult: ValidationReportResult;
  generatedAt: string;
}) {
  if (!params.validationResult.isValid) throw new Error('REPORT_VALIDATION_BLOCKED');

  const payload = await generateGovernmentReadyReportData({
    schoolId: params.schoolId,
    reportType: params.reportType,
    scopeType: params.scopeType,
    classSectionIds: params.validationResult.resolvedScope.classSectionIds,
    studentIds:
      params.scopeType === 'SELECTED_STUDENTS' || params.scopeType === 'ONE_STUDENT'
        ? params.validationResult.resolvedScope.studentIds
        : undefined,
    startDate: params.startDate,
    endDate: params.endDate,
    reportVersion: params.reportVersion,
    profileVersion: `${params.profileSnapshot.profileName} ${params.profileSnapshot.version}`,
    internalApprovalStatus: 'READY_FOR_REVIEW',
  });

  const missingData = params.validationResult.warnings.map((warning) => ({
    date: '',
    className: '',
    sectionName: '',
    issue: warning.message,
    code: warning.code,
    details: warning.details || {},
  }));

  return {
    ...payload,
    reportId: params.reportId,
    reportType: params.reportType,
    scopeType: params.scopeType,
    locale: params.locale,
    generatedAt: params.generatedAt,
    profileSnapshot: params.profileSnapshot,
    validationSnapshot: params.validationResult,
    missingData,
  };
}

export type ValidatedGovernmentReportPayload = Awaited<
  ReturnType<typeof generateValidatedGovernmentReportData>
>;
