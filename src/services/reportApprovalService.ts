import crypto from 'node:crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { reportApprovals, users, schools } from '../db/schema';
import { createAuditLog } from './auditLogService';
import { validateReportScope, ValidationReportResult } from './reportValidationService';

export interface CreateReportDraftParams {
  schoolId: string;
  reportType: string;
  scopeType: 'WHOLE_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_CLASSES' | 'SELECTED_SECTION' | 'SELECTED_STUDENTS' | 'ONE_STUDENT';
  scopeParameters?: Record<string, any>;
  periodType: string;
  periodStartDate: string;
  periodEndDate: string;
  profileId?: string;
  profileVersion?: string;
  actorId?: string;
}

export async function createReportDraft(params: CreateReportDraftParams) {
  // 1. Run Pre-flight Validation
  const validationResult = await validateReportScope({
    schoolId: params.schoolId,
    reportType: params.reportType,
    scopeType: params.scopeType,
    classSectionIds: params.scopeParameters?.classSectionIds,
    studentIds: params.scopeParameters?.studentIds,
    startDate: params.periodStartDate,
    endDate: params.periodEndDate,
  });

  // Determine latest report version for this school/reportType/period
  const existingReports = await db
    .select({ reportVersion: reportApprovals.reportVersion })
    .from(reportApprovals)
    .where(
      and(
        eq(reportApprovals.schoolId, params.schoolId),
        eq(reportApprovals.reportType, params.reportType),
        eq(reportApprovals.periodStartDate, params.periodStartDate),
        eq(reportApprovals.periodEndDate, params.periodEndDate)
      )
    )
    .orderBy(desc(reportApprovals.reportVersion));

  const nextVersion = (existingReports[0]?.reportVersion || 0) + 1;

  const initialStatus = validationResult.isValid
    ? validationResult.warnings.length === 0
      ? 'READY_FOR_REVIEW'
      : 'VALIDATED'
    : 'DRAFT';

  const [report] = await db
    .insert(reportApprovals)
    .values({
      schoolId: params.schoolId,
      reportType: params.reportType,
      scopeType: params.scopeType,
      scopeParameters: params.scopeParameters,
      periodType: params.periodType,
      periodStartDate: params.periodStartDate,
      periodEndDate: params.periodEndDate,
      profileId: params.profileId,
      profileVersion: params.profileVersion || '1.0.0',
      reportVersion: nextVersion,
      status: initialStatus,
      validationSummary: validationResult,
      metadata: validationResult.summary,
      generatedBy: params.actorId || null,
      generatedAt: new Date(),
    })
    .returning();

  if (params.actorId) {
    await createAuditLog({
      schoolId: params.schoolId,
      actorId: params.actorId,
      action: 'REPORT_DRAFT_CREATED',
      resourceType: 'REPORT',
      resourceId: report.id,
      metadata: {
        reportId: report.id,
        reportType: report.reportType,
        reportVersion: report.reportVersion,
        status: report.status,
        summary: validationResult.summary,
      },
    });
  }

  return { report, validationResult };
}

export async function approveReportInternally(params: {
  schoolId: string;
  reportId: string;
  actorId: string;
  userRole: string;
}) {
  if (params.userRole !== 'SUPER_ADMIN' && params.userRole !== 'SCHOOL_ADMIN') {
    throw new Error('Unauthorized: Only School Administrators or authorized Headmasters can approve reports internally.');
  }

  const [report] = await db
    .select()
    .from(reportApprovals)
    .where(
      and(
        eq(reportApprovals.id, params.reportId),
        eq(reportApprovals.schoolId, params.schoolId)
      )
    );

  if (!report) {
    throw new Error('Report record not found.');
  }

  if (report.status === 'SUPERSEDED') {
    throw new Error('Cannot approve a superseded report version.');
  }

  // Supersede previous approved versions for the same period
  await db
    .update(reportApprovals)
    .set({
      status: 'SUPERSEDED',
      supersededAt: new Date(),
      supersededBy: params.actorId,
    })
    .where(
      and(
        eq(reportApprovals.schoolId, params.schoolId),
        eq(reportApprovals.reportType, report.reportType),
        eq(reportApprovals.periodStartDate, report.periodStartDate),
        eq(reportApprovals.periodEndDate, report.periodEndDate),
        eq(reportApprovals.status, 'APPROVED_INTERNALLY')
      )
    );

  const [approvedReport] = await db
    .update(reportApprovals)
    .set({
      status: 'APPROVED_INTERNALLY',
      approvedBy: params.actorId,
      approvedAt: new Date(),
    })
    .where(eq(reportApprovals.id, report.id))
    .returning();

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    action: 'REPORT_APPROVED_INTERNALLY',
    resourceType: 'REPORT',
    resourceId: approvedReport.id,
    metadata: {
      reportId: approvedReport.id,
      reportType: approvedReport.reportType,
      reportVersion: approvedReport.reportVersion,
    },
  });

  return approvedReport;
}

export async function recordReportExport(params: {
  schoolId: string;
  reportId: string;
  fileBuffer: Buffer;
  actorId?: string;
}) {
  const hash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');

  const [report] = await db
    .update(reportApprovals)
    .set({
      fileHashSha256: hash,
      status: 'EXPORTED',
      downloadCount: sql`${reportApprovals.downloadCount} + 1`,
    })
    .where(
      and(
        eq(reportApprovals.id, params.reportId),
        eq(reportApprovals.schoolId, params.schoolId)
      )
    )
    .returning();

  if (params.actorId) {
    await createAuditLog({
      schoolId: params.schoolId,
      actorId: params.actorId,
      action: 'REPORT_DOWNLOADED',
      resourceType: 'REPORT',
      resourceId: params.reportId,
      metadata: {
        reportId: params.reportId,
        fileHashSha256: hash,
      },
    });
  }

  return { report, hash };
}

export async function getReportHistory(schoolId: string, limit = 50, offset = 0) {
  const history = await db
    .select({
      id: reportApprovals.id,
      schoolId: reportApprovals.schoolId,
      reportType: reportApprovals.reportType,
      scopeType: reportApprovals.scopeType,
      periodType: reportApprovals.periodType,
      periodStartDate: reportApprovals.periodStartDate,
      periodEndDate: reportApprovals.periodEndDate,
      reportVersion: reportApprovals.reportVersion,
      status: reportApprovals.status,
      fileHashSha256: reportApprovals.fileHashSha256,
      generatedAt: reportApprovals.generatedAt,
      approvedAt: reportApprovals.approvedAt,
      downloadCount: reportApprovals.downloadCount,
      metadata: reportApprovals.metadata,
      generatorName: users.fullName,
    })
    .from(reportApprovals)
    .leftJoin(users, eq(reportApprovals.generatedBy, users.id))
    .where(eq(reportApprovals.schoolId, schoolId))
    .orderBy(desc(reportApprovals.generatedAt))
    .limit(limit)
    .offset(offset);

  return history;
}
