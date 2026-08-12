import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudentStatus,
  updateStudentDetails,
} from '../services/studentService';
import { createAuditLog } from '../services/auditLogService';

export const studentRouter = Router();

// GET /api/v1/schools/:schoolId/students
studentRouter.get(
  '/:schoolId/students',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const classSectionId = req.query.classSectionId as string | undefined;
    const status = req.query.status as string | undefined;

    const students = await listStudents({ schoolId, classSectionId, status });
    return res.json({ students });
  }
);

// POST /api/v1/schools/:schoolId/students
studentRouter.post(
  '/:schoolId/students',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const {
      studentCode,
      name,
      nameBn,
      banglarShikshaId,
      dateOfBirth,
      gender,
      photoUrl,
      classSectionId,
      academicYearId,
      rollNumber,
      guardian,
    } = req.body;

    if (!studentCode || !name || !classSectionId || !academicYearId || rollNumber === undefined) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'studentCode, name, classSectionId, academicYearId, and rollNumber are required',
      });
    }

    try {
      const result = await createStudent({
        schoolId,
        studentCode,
        name,
        nameBn,
        banglarShikshaId,
        dateOfBirth,
        gender,
        photoUrl,
        classSectionId,
        academicYearId,
        rollNumber: Number(rollNumber),
        guardian,
      });

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'CREATE_STUDENT',
        resourceType: 'STUDENT',
        resourceId: result.student.id,
        metadata: {
          studentCode,
          name,
          guardianPhone: guardian?.phoneNumber,
        },
      });

      return res.status(201).json(result);
    } catch (err: any) {
      if (err.message === 'DUPLICATE_STUDENT_CODE') {
        return res.status(409).json({ error: 'DUPLICATE_STUDENT_CODE', message: 'Student code already exists in this school' });
      }
      if (err.message === 'DUPLICATE_ROLL_NUMBER') {
        return res.status(409).json({ error: 'DUPLICATE_ROLL_NUMBER', message: 'Roll number already exists in this class section' });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
);

// GET /api/v1/schools/:schoolId/students/:studentId
studentRouter.get(
  '/:schoolId/students/:studentId',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.params;

    const studentData = await getStudentById(schoolId, studentId);
    if (!studentData) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    return res.json(studentData);
  }
);

// PATCH /api/v1/schools/:schoolId/students/:studentId
studentRouter.patch(
  '/:schoolId/students/:studentId',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.params;

    const updated = await updateStudentDetails(schoolId, studentId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'UPDATE_STUDENT',
      resourceType: 'STUDENT',
      resourceId: studentId,
      metadata: req.body,
    });

    return res.json({ student: updated });
  }
);

// POST /api/v1/schools/:schoolId/students/:studentId/status
studentRouter.post(
  '/:schoolId/students/:studentId/status',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'TRANSFERRED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be ACTIVE, INACTIVE, or TRANSFERRED' });
    }

    const updated = await updateStudentStatus(schoolId, studentId, status);
    if (!updated) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'UPDATE_STUDENT_STATUS',
      resourceType: 'STUDENT',
      resourceId: studentId,
      metadata: { newStatus: status },
    });

    return res.json({ student: updated });
  }
);
