import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { reportApprovals, users } from '../db/schema';
import { createAuditLog } from './auditLogService';
import { ValidationReportResult, validateReportScope } from './reportValidationService';
import { ReportingProfileSnapshot } from './reportProfileService';
import { ReportArtifactFormat } from './reportArtifactService';

export interface CreateReportDraftParams {
  schoolId: string;
  reportType: string;
  scopeType:
    | 'WHOLE_SCHOOL'
    | 'ALL_CLASSES'
    | 'SELECTED_CLASSES'
    | 'SELECTED_SECTION'
    | 'SELECTED_STUDENTS'
    | 'ONE_STUDENT';
  scopeParameters?: Record<string, unknown>;
  periodType: string;
  periodStartDate: string;
  periodEndDate: string;
  profileSnapshot: ReportingProfileSnapshot;
  format: ReportArtifactFormat;
  locale?: 'en' | 'bn' | 'hi';
  actorId?: string;
  validationResult?: ValidationReportResult;
}

function mergeMetadata(current: unknown, next: Record<string, unknown>): Record<string, unknown> {
  return { ...((current && typeof current === 'object' ? current : {}) as Record<string, unknown>), ...next };
}

export async function createReportDraft(params: CreateReportDraftParams) {
  const validationResult =
    params.validationResult ||
    (await validateReportScope({
      schoolId: params.schoolId,
      reportType: params.reportType,
      scopeType: params.scopeType,
      classSectionIds: params.scopeParameters?.classSectionIds as string[] | undefined,
      studentIds: params.scopeParameters?.studentIds as string[] | undefined,
      startDate: params.periodStartDate,
      endDate: params.periodEndDate,
      locale: params.locale,
    }));
  if (!validationResult.isValid) throw new Error('REPORT_VALIDATION_BLOCKED');

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
    .orderBy(desc(reportApprovals.reportVersion))
    .limit(1);
  const nextVersion = (existingReports[0]?.reportVersion || 0) + 1;

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
      profileId: params.profileSnapshot.id,
      profileVersion: params.profileSnapshot.version,
      reportVersion: nextVersion,
      status: 'VALIDATED',
      validationSummary: validationResult,
      metadata: {
        contractVersion: '2.0.0',
        artifactFormat: params.format,
        locale: params.locale || 'en',
        profileSnapshot: params.profileSnapshot,
        validationSnapshot: validationResult.summary,
      },
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
        format: params.format,
        profileId: params.profileSnapshot.id,
        profileVersion: params.profileSnapshot.version,
      },
    });
  }
  return { report, validationResult };
}

export async function recordReportArtifact(params: {
  schoolId: string;
  reportId: string;
  artifact: {
    id: string;
    format: ReportArtifactFormat;
    contentType: string;
    filename: string;
    byteSize: number;
    sha256: string;
    storageBackend: 'database' | 'filesystem';
    createdAt: Date;
  };
  actorId?: string;
}) {
  const report = await db.transaction(async (tx) => {
    const selected = await tx.execute(sql`
      SELECT * FROM report_approvals
      WHERE id = ${params.reportId}::uuid AND school_id = ${params.schoolId}::uuid
      FOR UPDATE
    `);
    const current = (selected.rows as any[])[0];
    if (!current) throw new Error('REPORT_NOT_FOUND');
    if (current.file_hash_sha256) throw new Error('REPORT_ARTIFACT_ALREADY_ATTACHED');
    if (current.status !== 'VALIDATED') throw new Error('REPORT_ARTIFACT_TRANSITION_INVALID');

    const [updated] = await tx
      .update(reportApprovals)
      .set({
        fileHashSha256: params.artifact.sha256,
        status: 'READY_FOR_REVIEW',
        metadata: mergeMetadata(current.metadata, {
          artifact: {
            id: params.artifact.id,
            format: params.artifact.format,
            contentType: params.artifact.contentType,
            filename: params.artifact.filename,
            byteSize: params.artifact.byteSize,
            sha256: params.artifact.sha256,
            storageBackend: params.artifact.storageBackend,
            createdAt: params.artifact.createdAt.toISOString(),
          },
        }),
      })
      .where(and(eq(reportApprovals.id, params.reportId), eq(reportApprovals.schoolId, params.schoolId)))
      .returning();
    return updated;
  });

  if (params.actorId) {
    await createAuditLog({
      schoolId: params.schoolId,
      actorId: params.actorId,
      action: 'REPORT_ARTIFACT_CREATED',
      resourceType: 'REPORT',
      resourceId: params.reportId,
      metadata: {
        reportId: params.reportId,
        artifactId: params.artifact.id,
        format: params.artifact.format,
        byteSize: params.artifact.byteSize,
        fileHashSha256: params.artifact.sha256,
      },
    });
  }
  return report;
}

export async function approveReportInternally(params: {
  schoolId: string;
  reportId: string;
  actorId: string;
  userRole: string;
}) {
  if (params.userRole !== 'SUPER_ADMIN' && params.userRole !== 'SCHOOL_ADMIN') {
    throw new Error('REPORT_APPROVAL_FORBIDDEN');
  }

  const approvedReport = await db.transaction(async (tx) => {
    const selected = await tx.execute(sql`
      SELECT * FROM report_approvals
      WHERE id = ${params.reportId}::uuid AND school_id = ${params.schoolId}::uuid
      FOR UPDATE
    `);
    const report = (selected.rows as any[])[0];
    if (!report) throw new Error('REPORT_NOT_FOUND');
    if (report.status === 'APPROVED_INTERNALLY') {
      const [alreadyApproved] = await tx
        .select()
        .from(reportApprovals)
        .where(and(eq(reportApprovals.id, params.reportId), eq(reportApprovals.schoolId, params.schoolId)))
        .limit(1);
      return alreadyApproved;
    }
    if (report.status !== 'READY_FOR_REVIEW' || !report.file_hash_sha256) {
      throw new Error('REPORT_APPROVAL_TRANSITION_INVALID');
    }

    await tx
      .update(reportApprovals)
      .set({
        status: 'SUPERSEDED',
        supersededAt: new Date(),
        supersededBy: params.actorId,
      })
      .where(
        and(
          eq(reportApprovals.schoolId, params.schoolId),
          eq(reportApprovals.reportType, report.report_type),
          eq(reportApprovals.periodStartDate, String(report.period_start_date)),
          eq(reportApprovals.periodEndDate, String(report.period_end_date)),
          eq(reportApprovals.status, 'APPROVED_INTERNALLY')
        )
      );

    const [approved] = await tx
      .update(reportApprovals)
      .set({
        status: 'APPROVED_INTERNALLY',
        approvedBy: params.actorId,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(reportApprovals.id, params.reportId),
          eq(reportApprovals.schoolId, params.schoolId),
          eq(reportApprovals.status, 'READY_FOR_REVIEW')
        )
      )
      .returning();
    if (!approved) throw new Error('REPORT_APPROVAL_CONFLICT');
    return approved;
  });

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
      fileHashSha256: approvedReport.fileHashSha256,
    },
  });
  return approvedReport;
}

export async function recordReportDownload(params: {
  schoolId: string;
  reportId: string;
  artifactHash: string;
  actorId?: string;
}) {
  const [current] = await db
    .select()
    .from(reportApprovals)
    .where(and(eq(reportApprovals.id, params.reportId), eq(reportApprovals.schoolId, params.schoolId)))
    .limit(1);
  if (!current) throw new Error('REPORT_NOT_FOUND');
  if (!current.fileHashSha256 || current.fileHashSha256 !== params.artifactHash) {
    throw new Error('REPORT_ARTIFACT_HASH_MISMATCH');
  }

  const [report] = await db
    .update(reportApprovals)
    .set({ downloadCount: sql`${reportApprovals.downloadCount} + 1` })
    .where(and(eq(reportApprovals.id, params.reportId), eq(reportApprovals.schoolId, params.schoolId)))
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
        fileHashSha256: params.artifactHash,
        statusPreserved: report.status,
      },
    });
  }
  return { report, hash: params.artifactHash };
}

// Compatibility for older imports. A download can only be recorded after the
// same bytes have been persisted as the immutable artifact.
export async function recordReportExport(params: {
  schoolId: string;
  reportId: string;
  fileBuffer: Buffer;
  actorId?: string;
}) {
  const hash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');
  return recordReportDownload({
    schoolId: params.schoolId,
    reportId: params.reportId,
    artifactHash: hash,
    actorId: params.actorId,
  });
}

export async function getReportRecord(schoolId: string, reportId: string) {
  const [report] = await db
    .select()
    .from(reportApprovals)
    .where(and(eq(reportApprovals.id, reportId), eq(reportApprovals.schoolId, schoolId)))
    .limit(1);
  return report || null;
}

export async function getReportHistory(schoolId: string, limit = 50, offset = 0) {
  return db
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
}
