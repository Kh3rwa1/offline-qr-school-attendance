import { Router } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/authMiddleware';
import { tenantRoute } from '../http/tenantRoute';
import { AppError } from '../errors/AppError';
import {
  students,
  guardians,
  studentGuardians,
  attendanceRecords,
  rfidScanEvents,
  guardianConsents,
  notificationJobs,
  rfidCredentials,
} from '../db/schema';
import { hasConsent } from '../services/privacy/consent';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudentStatus,
  updateStudentDetails,
} from '../services/studentService';
import { createAuditLog, writeAuditLog } from '../services/auditLogService';
import { runRetention } from '../jobs/retention';
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
    handler: async ({ tx, schoolId, user, params, body }) => {
      if (body.photoUrl) {
        const consentGranted = await hasConsent(tx, schoolId, params.studentId, 'PHOTO');
        if (!consentGranted) {
          throw new AppError('CONSENT_REQUIRED', 409, 'Guardian consent for student photo is required');
        }
      }

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

// GET /api/v1/schools/:schoolId/students/:studentId/data-export
studentRouter.get(
  '/:schoolId/students/:studentId/data-export',
  tenantRoute({
    roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN'],
    params: StudentParams,
    handler: async ({ tx, schoolId, params, user }) => {
      const [student] = await tx
        .select()
        .from(students)
        .where(and(eq(students.id, params.studentId), eq(students.schoolId, schoolId)))
        .limit(1);

      if (!student) {
        throw new AppError('STUDENT_NOT_FOUND', 404, 'Student not found');
      }

      const guardianRows = await tx
        .select({
          id: guardians.id,
          name: guardians.name,
          phoneNumber: guardians.phoneNumber,
          relationship: guardians.relationship,
          isPrimary: studentGuardians.isPrimary,
        })
        .from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(eq(studentGuardians.studentId, params.studentId));

      const records = await tx
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.studentId, params.studentId));

      const scans = await tx
        .select()
        .from(rfidScanEvents)
        .where(eq(rfidScanEvents.studentId, params.studentId));

      const consents = await tx
        .select()
        .from(guardianConsents)
        .where(eq(guardianConsents.studentId, params.studentId));

      const notices = await tx
        .select()
        .from(notificationJobs)
        .where(eq(notificationJobs.studentId, params.studentId));

      await writeAuditLog({
        schoolId,
        actorId: user.id,
        action: 'STUDENT_DATA_EXPORTED',
        resourceType: 'STUDENT',
        targetId: params.studentId,
      });

      return {
        body: {
          data: {
            exportedAt: new Date().toISOString(),
            student,
            guardians: guardianRows,
            records,
            scans,
            consents,
            notices,
          },
        },
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="student-${params.studentId}.json"`,
        },
      };
    },
  })
);

// POST /api/v1/schools/:schoolId/students/:studentId/anonymize
studentRouter.post(
  '/:schoolId/students/:studentId/anonymize',
  tenantRoute({
    roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN'],
    params: StudentParams,
    handler: async ({ tx, schoolId, params, user }) => {
      const [student] = await tx
        .select()
        .from(students)
        .where(and(eq(students.id, params.studentId), eq(students.schoolId, schoolId)))
        .limit(1);

      if (!student) {
        throw new AppError('STUDENT_NOT_FOUND', 404, 'Student not found');
      }

      const pseudoCode = `ANON-${params.studentId.slice(0, 8)}`;
      await tx
        .update(students)
        .set({
          name: 'ANONYMIZED',
          nameBn: null,
          studentCode: pseudoCode,
          banglarShikshaId: null,
          dateOfBirth: null,
          photoUrl: null,
          status: 'INACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(students.id, params.studentId));

      await tx
        .update(rfidCredentials)
        .set({ status: 'REVOKED', revokedAt: new Date(), revocationReason: 'STUDENT_ANONYMIZED', updatedAt: new Date() })
        .where(eq(rfidCredentials.studentId, params.studentId));

      const guardianLinks = await tx
        .select({ guardianId: studentGuardians.guardianId })
        .from(studentGuardians)
        .where(eq(studentGuardians.studentId, params.studentId));

      for (const link of guardianLinks) {
        if (link.guardianId) {
          await tx
            .update(guardians)
            .set({
              name: 'REDACTED',
              phoneNumber: '0000000000',
            })
            .where(eq(guardians.id, link.guardianId));
        }
      }

      await tx
        .update(guardianConsents)
        .set({ withdrawnAt: new Date() })
        .where(and(eq(guardianConsents.studentId, params.studentId), isNull(guardianConsents.withdrawnAt)));

      await writeAuditLog({
        schoolId,
        actorId: user.id,
        action: 'STUDENT_ANONYMIZED',
        resourceType: 'STUDENT',
        targetId: params.studentId,
        metadata: { studentCode: pseudoCode },
      });

      return {
        body: {
          success: true,
          studentId: params.studentId,
          anonymized: true,
        },
      };
    },
  })
);

// POST /api/v1/schools/:schoolId/privacy/retention/run
studentRouter.post(
  '/:schoolId/privacy/retention/run',
  tenantRoute({
    roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN'],
    handler: async ({ schoolId, user }) => {
      const results = await runRetention(schoolId);
      await writeAuditLog({
        schoolId,
        actorId: user.id,
        action: 'RETENTION_PURGE_TRIGGERED',
        resourceType: 'RETENTION_POLICY',
        targetId: schoolId,
        metadata: { results },
      });
      return {
        body: {
          success: true,
          results,
        },
      };
    },
  })
);

