import { Router, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { students, schools, classSections, enrollments, qrCredentials } from '../db/schema';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  createQrCredential,
  revokeQrCredential,
  reissueQrCredential,
  verifyQrToken,
  bulkIssueQrsForClass,
  generateA4PrintSheetHtml,
  generateSecureQrToken,
  PrintableQrCard,
} from '../services/qrService';
import { createAuditLog } from '../services/auditLogService';

export const qrRouter = Router();

// POST /api/v1/schools/:schoolId/qr/issue
qrRouter.post(
  '/:schoolId/qr/issue',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'studentId is required' });
    }

    // Verify student belongs to school
    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)));

    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    const { credential, rawToken } = await createQrCredential(db, { schoolId, studentId });

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'ISSUE_QR_CREDENTIAL',
      resourceType: 'QR_CREDENTIAL',
      resourceId: credential.id,
      metadata: { studentId, version: credential.version },
    });

    return res.status(201).json({
      credential,
      rawToken, // Returned ONLY at generation time for printing/displaying
    });
  }
);

// POST /api/v1/schools/:schoolId/qr/revoke
qrRouter.post(
  '/:schoolId/qr/revoke',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'studentId is required' });
    }

    const revoked = await revokeQrCredential(schoolId, studentId);
    if (!revoked) {
      return res.status(404).json({ error: 'ACTIVE_QR_NOT_FOUND', message: 'No active QR credential found for student' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'REVOKE_QR_CREDENTIAL',
      resourceType: 'QR_CREDENTIAL',
      resourceId: revoked.id,
      metadata: { studentId },
    });

    return res.json({ status: 'ok', credential: revoked });
  }
);

// POST /api/v1/schools/:schoolId/qr/reissue
qrRouter.post(
  '/:schoolId/qr/reissue',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'studentId is required' });
    }

    // Verify student belongs to school
    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)));

    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    const { credential, rawToken } = await reissueQrCredential(schoolId, studentId);

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'REISSUE_QR_CREDENTIAL',
      resourceType: 'QR_CREDENTIAL',
      resourceId: credential.id,
      metadata: { studentId, version: credential.version },
    });

    return res.json({ credential, rawToken });
  }
);

// POST /api/v1/schools/:schoolId/qr/issue-bulk
qrRouter.post(
  '/:schoolId/qr/issue-bulk',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { classSectionId } = req.body;

    if (!classSectionId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'classSectionId is required' });
    }

    const issued = await bulkIssueQrsForClass(schoolId, classSectionId);

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'BULK_ISSUE_QR',
      resourceType: 'CLASS_SECTION',
      resourceId: classSectionId,
      metadata: { count: issued.length },
    });

    return res.json({
      issuedCount: issued.length,
      credentials: issued,
    });
  }
);

// POST /api/v1/schools/:schoolId/qr/verify
qrRouter.post(
  '/:schoolId/qr/verify',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { rawToken } = req.body;

    if (!rawToken) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'rawToken is required' });
    }

    const result = await verifyQrToken(schoolId, rawToken);
    return res.json(result);
  }
);

// GET/POST /api/v1/schools/:schoolId/qr/print-batch
qrRouter.all(
  '/:schoolId/qr/print-batch',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const classSectionId = (req.query.classSectionId || req.body.classSectionId) as string;

    if (!classSectionId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'classSectionId is required' });
    }

    const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
    if (!school) {
      return res.status(404).json({ error: 'SCHOOL_NOT_FOUND' });
    }

    // Fetch active students in class section
    const activeRoster = await db
      .select({
        studentId: students.id,
        studentCode: students.studentCode,
        name: students.name,
        nameBn: students.nameBn,
        photoUrl: students.photoUrl,
        className: classSections.className,
        sectionName: classSections.sectionName,
        rollNumber: enrollments.rollNumber,
      })
      .from(students)
      .innerJoin(enrollments, and(eq(students.id, enrollments.studentId), eq(enrollments.status, 'ACTIVE')))
      .innerJoin(classSections, eq(enrollments.classSectionId, classSections.id))
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(enrollments.classSectionId, classSectionId),
          eq(students.status, 'ACTIVE')
        )
      );

    const cards: PrintableQrCard[] = [];

    for (const r of activeRoster) {
      // Find active QR credential or generate
      const [existing] = await db
        .select()
        .from(qrCredentials)
        .where(
          and(
            eq(qrCredentials.schoolId, schoolId),
            eq(qrCredentials.studentId, r.studentId),
            eq(qrCredentials.status, 'ACTIVE')
          )
        );

      let rawToken: string;
      if (existing) {
        // Printing is an explicit reissue: the previous credential is revoked
        // before the new raw secret is returned for printing.
        const reissued = await reissueQrCredential(schoolId, r.studentId);
        rawToken = reissued.rawToken;
      } else {
        const created = await createQrCredential(db, { schoolId, studentId: r.studentId });
        rawToken = created.rawToken;
      }

      cards.push({
        studentId: r.studentId,
        studentCode: r.studentCode,
        name: r.name,
        nameBn: r.nameBn,
        className: r.className,
        sectionName: r.sectionName,
        rollNumber: r.rollNumber,
        photoUrl: r.photoUrl,
        rawToken,
      });
    }

    const html = await generateA4PrintSheetHtml({
      schoolName: school.name,
      cards,
    });

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'PRINT_QR_BATCH',
      resourceType: 'CLASS_SECTION',
      resourceId: classSectionId,
      metadata: { cardCount: cards.length },
    });

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
);
