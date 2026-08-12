import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  listAcademicYears,
  createAcademicYear,
  setCurrentAcademicYear,
  listClassSections,
  createClassSection,
  listTeachers,
  assignTeacherToClass,
  unassignTeacherFromClass,
} from '../services/academicService';
import { createAuditLog } from '../services/auditLogService';

export const academicRouter = Router();

// GET /api/v1/schools/:schoolId/academic-years
academicRouter.get(
  '/:schoolId/academic-years',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const years = await listAcademicYears(schoolId);
    return res.json({ academicYears: years });
  }
);

// POST /api/v1/schools/:schoolId/academic-years
academicRouter.post(
  '/:schoolId/academic-years',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { name, startDate, endDate, isCurrent } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Name, startDate, and endDate are required' });
    }

    try {
      const year = await createAcademicYear({
        schoolId,
        name,
        startDate,
        endDate,
        isCurrent: Boolean(isCurrent),
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'CREATE_ACADEMIC_YEAR',
        resourceType: 'ACADEMIC_YEAR',
        resourceId: year.id,
        metadata: { name },
      });

      return res.status(201).json({ academicYear: year });
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('unique')) {
        return res.status(409).json({ error: 'DUPLICATE_ACADEMIC_YEAR', message: 'Academic year name already exists' });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
);

// PATCH /api/v1/schools/:schoolId/academic-years/:id/set-current
academicRouter.patch(
  '/:schoolId/academic-years/:id/set-current',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { id } = req.params;

    const updated = await setCurrentAcademicYear(schoolId, id);
    if (!updated) {
      return res.status(404).json({ error: 'ACADEMIC_YEAR_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'SET_CURRENT_ACADEMIC_YEAR',
      resourceType: 'ACADEMIC_YEAR',
      resourceId: id,
    });

    return res.json({ academicYear: updated });
  }
);

// GET /api/v1/schools/:schoolId/class-sections
academicRouter.get(
  '/:schoolId/class-sections',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const academicYearId = req.query.academicYearId as string | undefined;

    const classes = await listClassSections(schoolId, academicYearId);
    return res.json({ classSections: classes });
  }
);

// POST /api/v1/schools/:schoolId/class-sections
academicRouter.post(
  '/:schoolId/class-sections',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { academicYearId, className, sectionName } = req.body;

    if (!academicYearId || !className || !sectionName) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'academicYearId, className, and sectionName are required',
      });
    }

    try {
      const created = await createClassSection({
        schoolId,
        academicYearId,
        className,
        sectionName,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'CREATE_CLASS_SECTION',
        resourceType: 'CLASS_SECTION',
        resourceId: created.id,
        metadata: { className, sectionName },
      });

      return res.status(201).json({ classSection: created });
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('unique')) {
        return res.status(409).json({
          error: 'DUPLICATE_CLASS_SECTION',
          message: 'Class section already exists for this academic year',
        });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
);

// GET /api/v1/schools/:schoolId/teachers
academicRouter.get(
  '/:schoolId/teachers',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const teachers = await listTeachers(schoolId);
    return res.json({ teachers });
  }
);

// POST /api/v1/schools/:schoolId/teachers/assign
academicRouter.post(
  '/:schoolId/teachers/assign',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { teacherId, classSectionId } = req.body;

    if (!teacherId || !classSectionId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'teacherId and classSectionId are required' });
    }

    try {
      const assignment = await assignTeacherToClass({ schoolId, teacherId, classSectionId });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'ASSIGN_TEACHER_CLASS',
        resourceType: 'TEACHER_ASSIGNMENT',
        resourceId: assignment.id,
        metadata: { teacherId, classSectionId },
      });

      return res.status(201).json({ assignment });
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('unique')) {
        return res.status(409).json({ error: 'DUPLICATE_ASSIGNMENT', message: 'Teacher already assigned to this class' });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
);

// DELETE /api/v1/schools/:schoolId/teachers/assign
academicRouter.delete(
  '/:schoolId/teachers/assign',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { teacherId, classSectionId } = req.body;

    if (!teacherId || !classSectionId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'teacherId and classSectionId are required' });
    }

    const unassigned = await unassignTeacherFromClass({ schoolId, teacherId, classSectionId });
    if (!unassigned) {
      return res.status(404).json({ error: 'ASSIGNMENT_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'UNASSIGN_TEACHER_CLASS',
      resourceType: 'TEACHER_ASSIGNMENT',
      resourceId: unassigned.id,
      metadata: { teacherId, classSectionId },
    });

    return res.json({ status: 'ok', assignment: unassigned });
  }
);
