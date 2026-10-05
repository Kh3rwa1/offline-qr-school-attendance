import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import { tenantRoute } from '../http/tenantRoute';
import { AppError } from '../errors/AppError';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudentStatus,
  updateStudentDetails,
} from '../services/studentService';
import { createAuditLog } from '../services/auditLogService';
import {
  CreateStudentBody,
  UpdateStudentDetailsBody,
  UpdateStudentStatusBody,
  ListStudentsQuery,
  Uuid,
} from './schemas/students';

export const studentRouter = Router();

const StudentParams = z.object({
  schoolId: Uuid,
  studentId: Uuid,
});

// GET /api/v1/schools/:schoolId/students
studentRouter.get(
  '/:schoolId/students',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    query: ListStudentsQuery,
    handler: async ({ schoolId, query }) => {
      const result = await listStudents({
        schoolId,
        classSectionId: query.classSectionId,
        status: query.status,
        search: query.search,
        limit: query.limit !== undefined ? String(query.limit) : undefined,
        cursor: query.cursor,
        page: query.page,
      });
      return {
        status: 200,
        body: {
          success: true,
          students: (result as any).items || result,
          nextCursor: (result as any).nextCursor || null,
          hasMore: !!(result as any).hasMore,
          limit: (result as any).limit || 50,
        },
      };
    },
  })
);

// POST /api/v1/schools/:schoolId/students
studentRouter.post(
  '/:schoolId/students',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    body: CreateStudentBody,
    handler: async ({ schoolId, user, body }) => {
      try {
        const result = await createStudent({
          schoolId,
          studentCode: body.studentCode,
          name: body.name,
          nameBn: body.nameBn,
          banglarShikshaId: body.banglarShikshaId,
          dateOfBirth: body.dateOfBirth,
          gender: body.gender,
          photoUrl: body.photoUrl,
          classSectionId: body.classSectionId,
          academicYearId: body.academicYearId,
          rollNumber: body.rollNumber,
          guardian: body.guardian,
        });

        await createAuditLog({
          schoolId,
          actorId: user.id,
          action: 'CREATE_STUDENT',
          resourceType: 'STUDENT',
          resourceId: result.student.id,
          metadata: {
            studentCode: body.studentCode,
            name: body.name,
            guardianPhone: body.guardian?.phoneNumber,
          },
        });

        return {
          status: 201,
          body: {
            success: true,
            data: result,
            ...result,
          },
        };
      } catch (err: any) {
        if (err.message === 'DUPLICATE_STUDENT_CODE') {
          throw new AppError('DUPLICATE_STUDENT_CODE', 409, 'Student code already exists in this school');
        }
        if (err.message === 'DUPLICATE_ROLL_NUMBER') {
          throw new AppError('DUPLICATE_ROLL_NUMBER', 409, 'Roll number already exists in this class section');
        }
        throw err;
      }
    },
  })
);

// GET /api/v1/schools/:schoolId/students/:studentId
studentRouter.get(
  '/:schoolId/students/:studentId',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    params: StudentParams,
    handler: async ({ schoolId, params }) => {
      const studentData = await getStudentById(schoolId, params.studentId);
      if (!studentData) {
        throw new AppError('STUDENT_NOT_FOUND', 404, 'Student not found');
      }
      return { status: 200, body: studentData };
    },
  })
);

// PATCH /api/v1/schools/:schoolId/students/:studentId
studentRouter.patch(
  '/:schoolId/students/:studentId',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    params: StudentParams,
    body: UpdateStudentDetailsBody,
    handler: async ({ schoolId, user, params, body }) => {
      const updated = await updateStudentDetails(schoolId, params.studentId, body);
      if (!updated) {
        throw new AppError('STUDENT_NOT_FOUND', 404, 'Student not found');
      }

      await createAuditLog({
        schoolId,
        actorId: user.id,
        action: 'UPDATE_STUDENT',
        resourceType: 'STUDENT',
        resourceId: params.studentId,
        metadata: body,
      });

      return { status: 200, body: { student: updated } };
    },
  })
);

// POST /api/v1/schools/:schoolId/students/:studentId/status
studentRouter.post(
  '/:schoolId/students/:studentId/status',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    params: StudentParams,
    body: UpdateStudentStatusBody,
    handler: async ({ schoolId, user, params, body }) => {
      const updated = await updateStudentStatus(schoolId, params.studentId, body.status);
      if (!updated) {
        throw new AppError('STUDENT_NOT_FOUND', 404, 'Student not found');
      }

      await createAuditLog({
        schoolId,
        actorId: user.id,
        action: 'UPDATE_STUDENT_STATUS',
        resourceType: 'STUDENT',
        resourceId: params.studentId,
        metadata: { newStatus: body.status },
      });

      return { status: 200, body: { student: updated } };
    },
  })
);
