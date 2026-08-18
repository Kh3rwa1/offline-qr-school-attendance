import { Router, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { teacherAssignments } from '../db/schema';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { approveReportInternally, createReportDraft, getReportHistory, getReportRecord, recordReportArtifact, recordReportDownload } from '../services/reportApprovalService';
import { loadReportArtifact, persistReportArtifact } from '../services/reportArtifactService';
import { generateValidatedGovernmentReportData, GOVERNMENT_REPORT_TYPES } from '../services/governmentReportDataService';
import { buildGovernmentReportArtifact } from '../services/governmentReportExportService';
import { reportGenerationQueue } from '../services/reportGenerationQueue';
import { listAvailableReportingProfiles, resolveReportingProfile } from '../services/reportProfileService';
import { ReportLocale, ReportScopeType, validateReportScope } from '../services/reportValidationService';

export const governmentReportRouter = Router({ mergeParams: true });

const ScopeSchema = z.enum(['WHOLE_SCHOOL', 'ALL_CLASSES', 'SELECTED_CLASSES', 'SELECTED_SECTION', 'SELECTED_STUDENTS', 'ONE_STUDENT']);
const RequestSchema = z.object({
  reportType: z.enum(GOVERNMENT_REPORT_TYPES),
  format: z.enum(['xlsx', 'csv', 'html']).default('xlsx'),
  scopeType: ScopeSchema,
  classSectionIds: z.array(z.string().uuid()).max(500).optional(),
  studentIds: z.array(z.string().uuid()).max(5000).optional(),
  periodType: z.string().min(1).max(50).default('CUSTOM_RANGE'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profileId: z.string().uuid().optional(),
  locale: z.enum(['en', 'bn', 'hi']).optional(),
}).superRefine((value, context) => {
  if (value.startDate > value.endDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'INVALID_DATE_RANGE' });
  if (value.scopeType === 'SELECTED_SECTION' && value.classSectionIds?.length !== 1) context.addIssue({ code: 'custom', path: ['classSectionIds'], message: 'SELECTED_SECTION_REQUIRES_ONE' });
  if (value.scopeType === 'SELECTED_CLASSES' && !value.classSectionIds?.length) context.addIssue({ code: 'custom', path: ['classSectionIds'], message: 'EMPTY_CLASS_SCOPE' });
  if (value.scopeType === 'ONE_STUDENT' && value.studentIds?.length !== 1) context.addIssue({ code: 'custom', path: ['studentIds'], message: 'ONE_STUDENT_SCOPE_REQUIRES_ONE' });
  if (value.scopeType === 'SELECTED_STUDENTS' && !value.studentIds?.length) context.addIssue({ code: 'custom', path: ['studentIds'], message: 'EMPTY_STUDENT_SCOPE' });
});

function roleFor(req: AuthenticatedRequest): string {
  if (req.sessionContext?.platformRole === 'SUPER_ADMIN' || req.user?.platformRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return req.userRole || req.sessionContext?.activeMembership?.role || '';
}

function localeFor(req: AuthenticatedRequest, explicit?: unknown): ReportLocale {
  if (explicit === 'bn' || explicit === 'hi' || explicit === 'en') return explicit;
  const header = String(req.headers['accept-language'] || '').toLowerCase();
  return header.startsWith('bn') ? 'bn' : header.startsWith('hi') ? 'hi' : 'en';
}

const MESSAGES: Record<string, Record<ReportLocale, string>> = {
  REPORT_VALIDATION_BLOCKED: { en: 'Fix the blocking validation items before generating this report.', bn: 'রিপোর্ট তৈরির আগে বাধাদানকারী যাচাই সমস্যাগুলি ঠিক করুন।', hi: 'रिपोर्ट बनाने से पहले अवरोधक सत्यापन समस्याएँ ठीक करें।' },
  REPORT_NOT_FOUND: { en: 'The report was not found.', bn: 'রিপোর্টটি পাওয়া যায়নি।', hi: 'रिपोर्ट नहीं मिली।' },
  REPORT_ARTIFACT_NOT_FOUND: { en: 'This report has no stored artifact. Generate a new report; historical reports are never rebuilt from changed data.', bn: 'এই রিপোর্টের সংরক্ষিত ফাইল নেই। নতুন রিপোর্ট তৈরি করুন; পুরোনো রিপোর্ট পরিবর্তিত তথ্য থেকে আবার তৈরি হয় না।', hi: 'इस रिपोर्ट की संग्रहीत फ़ाइल नहीं है। नई रिपोर्ट बनाएँ; पुरानी रिपोर्ट बदले डेटा से दोबारा नहीं बनती।' },
  REPORT_DOWNLOAD_FORMAT_MISMATCH: { en: 'The requested format does not match the stored artifact.', bn: 'চাওয়া ফরম্যাটটি সংরক্ষিত ফাইলের সঙ্গে মিলছে না।', hi: 'माँगा गया प्रारूप संग्रहीत फ़ाइल से मेल नहीं खाता।' },
  REPORT_GENERATION_QUEUE_FULL: { en: 'The report queue is full. Try again after another export finishes.', bn: 'রিপোর্টের সারি পূর্ণ। অন্য এক্সপোর্ট শেষ হলে আবার চেষ্টা করুন।', hi: 'रिपोर्ट कतार भरी है। दूसरा निर्यात पूरा होने पर फिर प्रयास करें।' },
  REPORT_APPROVAL_TRANSITION_INVALID: { en: 'Only an artifact-backed report ready for review can be approved.', bn: 'শুধু ফাইলসহ পর্যালোচনার জন্য প্রস্তুত রিপোর্ট অনুমোদন করা যায়।', hi: 'केवल संग्रहीत फ़ाइल वाली समीक्षा-योग्य रिपोर्ट स्वीकृत की जा सकती है।' },
  REPORT_PROFILE_NOT_FOUND_OR_FORBIDDEN: { en: 'The selected profile is unavailable for this school.', bn: 'নির্বাচিত প্রোফাইলটি এই বিদ্যালয়ের জন্য উপলভ্য নয়।', hi: 'चुनी गई प्रोफ़ाइल इस विद्यालय के लिए उपलब्ध नहीं है।' },
  REPORT_ARTIFACT_HASH_MISMATCH: { en: 'Artifact integrity verification failed. The file was not served.', bn: 'ফাইলের অখণ্ডতা যাচাই ব্যর্থ হয়েছে। ফাইলটি পাঠানো হয়নি।', hi: 'फ़ाइल अखंडता जाँच विफल हुई। फ़ाइल नहीं भेजी गई।' },
};

function statusFor(code: string): number {
  if (code.includes('FORBIDDEN')) return 403;
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('QUEUE_FULL')) return 503;
  if (code.includes('LIMIT')) return 413;
  if (code.includes('MISMATCH') || code.includes('TRANSITION') || code.includes('ALREADY')) return 409;
  return 400;
}

function fail(res: Response, error: unknown, locale: ReportLocale) {
  if (error instanceof z.ZodError) {
    const code = error.issues[0]?.message || 'REPORT_REQUEST_INVALID';
    res.status(400).json({ success: false, error: code, messageKey: `report.error.${code}`, issues: error.issues });
    return;
  }
  const code = error instanceof Error ? error.message : 'REPORT_REQUEST_FAILED';
  res.status(statusFor(code)).json({ success: false, error: code, messageKey: `report.error.${code}`, message: MESSAGES[code]?.[locale] || MESSAGES[code]?.en || code });
}

async function assignedSections(req: AuthenticatedRequest, schoolId: string): Promise<string[] | undefined> {
  if (roleFor(req) !== 'TEACHER') return undefined;
  const rows: Array<{ classSectionId: string }> = await db.select({ classSectionId: teacherAssignments.classSectionId }).from(teacherAssignments).where(and(
    eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherId, req.user!.id)
  ));
  return rows.map((row) => row.classSectionId);
}

async function assertRead(req: AuthenticatedRequest, report: any) {
  if (roleFor(req) !== 'TEACHER') return;
  const allowed = new Set((await assignedSections(req, report.schoolId)) || []);
  const scope = (report.scopeParameters || {}) as { classSectionIds?: string[] };
  if (!scope.classSectionIds?.length || scope.classSectionIds.some((id) => !allowed.has(id))) throw new Error('REPORT_READ_FORBIDDEN');
}

governmentReportRouter.get('/profiles', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req);
  try { res.json({ success: true, profiles: await listAvailableReportingProfiles(req.activeSchoolId!) }); } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.post('/validate', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']), async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req, req.body?.locale);
  try {
    const input = RequestSchema.parse(req.body);
    const schoolId = req.activeSchoolId!;
    const profile = await resolveReportingProfile(schoolId, input.profileId);
    const validation = await validateReportScope({ schoolId, reportType: input.reportType, scopeType: input.scopeType as ReportScopeType, classSectionIds: input.classSectionIds, studentIds: input.studentIds, allowedClassSectionIds: await assignedSections(req, schoolId), startDate: input.startDate, endDate: input.endDate, locale });
    res.status(validation.isValid ? 200 : 422).json({ success: validation.isValid, profile, validation });
  } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.post('/generate', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']), async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req, req.body?.locale);
  try {
    const input = RequestSchema.parse(req.body);
    const schoolId = req.activeSchoolId!;
    const profile = await resolveReportingProfile(schoolId, input.profileId);
    const validation = await validateReportScope({ schoolId, reportType: input.reportType, scopeType: input.scopeType as ReportScopeType, classSectionIds: input.classSectionIds, studentIds: input.studentIds, allowedClassSectionIds: await assignedSections(req, schoolId), startDate: input.startDate, endDate: input.endDate, locale });
    if (!validation.isValid) { res.status(422).json({ success: false, error: 'REPORT_VALIDATION_BLOCKED', validation }); return; }

    const result = await reportGenerationQueue.enqueue(async () => {
      const scopeParameters = { classSectionIds: validation.resolvedScope.classSectionIds, studentIds: validation.resolvedScope.studentIds, requestedClassSectionIds: input.classSectionIds || [], requestedStudentIds: input.studentIds || [] };
      const draft = await createReportDraft({ schoolId, reportType: input.reportType, scopeType: input.scopeType, scopeParameters, periodType: input.periodType, periodStartDate: input.startDate, periodEndDate: input.endDate, profileSnapshot: profile, format: input.format, locale, actorId: req.user!.id, validationResult: validation });
      const generatedAt = draft.report.generatedAt instanceof Date ? draft.report.generatedAt.toISOString() : new Date().toISOString();
      const payload = await generateValidatedGovernmentReportData({ schoolId, reportId: draft.report.id, reportType: input.reportType, scopeType: input.scopeType, startDate: input.startDate, endDate: input.endDate, reportVersion: draft.report.reportVersion, profileSnapshot: profile, locale, validationResult: validation, generatedAt });
      const generated = await buildGovernmentReportArtifact(payload, input.format);
      const artifact = await persistReportArtifact({ schoolId, reportId: draft.report.id, format: generated.format, contentType: generated.contentType, filename: generated.filename, content: generated.content });
      const report = await recordReportArtifact({ schoolId, reportId: draft.report.id, artifact, actorId: req.user!.id });
      return { report, artifact, validation };
    });
    res.status(201).json({ success: true, reportId: result.report.id, status: result.report.status, reportVersion: result.report.reportVersion, validation: result.validation, artifact: { format: result.artifact.format, contentType: result.artifact.contentType, filename: result.artifact.filename, byteSize: result.artifact.byteSize, sha256: result.artifact.sha256, downloadUrl: `/api/v1/schools/${schoolId}/reports/${result.report.id}/download` } });
  } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.get('/history', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']), async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req);
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
    res.json({ success: true, history: await getReportHistory(req.activeSchoolId!, limit, offset), pagination: { limit, offset } });
  } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.get('/:reportId/download', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req);
  try {
    const schoolId = req.activeSchoolId!;
    const reportId = z.string().uuid().parse(req.params.reportId);
    const requestedFormat = req.query.format ? z.enum(['xlsx', 'csv', 'html']).parse(req.query.format) : undefined;
    const report = await getReportRecord(schoolId, reportId);
    if (!report) throw new Error('REPORT_NOT_FOUND');
    await assertRead(req, report);
    const artifact = await loadReportArtifact(schoolId, reportId);
    if (!artifact) throw new Error('REPORT_ARTIFACT_NOT_FOUND');
    if (requestedFormat && requestedFormat !== artifact.format) throw new Error('REPORT_DOWNLOAD_FORMAT_MISMATCH');
    if (report.fileHashSha256 !== artifact.sha256) throw new Error('REPORT_ARTIFACT_HASH_MISMATCH');
    await recordReportDownload({ schoolId, reportId, artifactHash: artifact.sha256, actorId: req.user!.id });
    res.setHeader('Content-Type', artifact.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
    res.setHeader('Content-Length', String(artifact.byteSize));
    res.setHeader('X-Content-SHA256', artifact.sha256);
    res.setHeader('ETag', `"sha256-${artifact.sha256}"`);
    res.status(200).send(artifact.content);
  } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.get('/:reportId', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req);
  try {
    const report = await getReportRecord(req.activeSchoolId!, z.string().uuid().parse(req.params.reportId));
    if (!report) throw new Error('REPORT_NOT_FOUND');
    await assertRead(req, report);
    res.json({ success: true, report });
  } catch (error) { fail(res, error, locale); }
});

governmentReportRouter.post('/:reportId/approve', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const locale = localeFor(req);
  try {
    const report = await approveReportInternally({ schoolId: req.activeSchoolId!, reportId: z.string().uuid().parse(req.params.reportId), actorId: req.user!.id, userRole: roleFor(req) });
    res.json({ success: true, report });
  } catch (error) { fail(res, error, locale); }
});
