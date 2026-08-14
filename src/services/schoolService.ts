import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { db, withSystemContext } from '../db';
import { schools, users, schoolMemberships, academicYears, schoolSmsSettings } from '../db/schema';
import { hashPassword } from '../auth/password';
import { createAuditLog } from './auditLogService';

export interface ProvisionSchoolInput {
  name: string;
  udiseCode: string;
  district: string;
  block?: string;
  preferredLanguage?: 'bn' | 'en' | 'hi';
  timezone?: string;
  admin: {
    fullName: string;
    phoneNumber: string;
    email?: string;
    password?: string;
  };
  academicYear?: {
    name: string;
    startDate: string;
    endDate: string;
  };
}

export interface SchoolListOptions {
  search?: string;
  status?: string;
  district?: string;
  page?: number;
  limit?: number;
}

export class SchoolService {
  /**
   * Provision a new school atomically with its administrator account, membership,
   * initial academic year, default SMS settings, and audit record.
   */
  static async provisionSchool(
    input: ProvisionSchoolInput,
    actorId: string,
    idempotencyKey?: string
  ) {
    // 1. Normalize and validate inputs
    const normalizedUdise = input.udiseCode.trim();
    if (!/^\d{11}$/.test(normalizedUdise)) {
      const error: any = new Error('UDISE code must be exactly 11 digits');
      error.code = 'INVALID_INPUT';
      error.status = 400;
      throw error;
    }

    const normalizedPhone = input.admin.phoneNumber.trim().replace(/[\s-]/g, '');
    if (!/^\+?[1-9]\d{9,14}$/.test(normalizedPhone)) {
      const error: any = new Error('Admin phone number must be a valid E.164 format phone number');
      error.code = 'INVALID_INPUT';
      error.status = 400;
      throw error;
    }

    return withSystemContext(async (tx) => {
      // 2. Check for duplicate UDISE code
      const [existingUdise] = await tx
        .select({ id: schools.id })
        .from(schools)
        .where(eq(schools.udiseCode, normalizedUdise));

      if (existingUdise) {
        const error: any = new Error(`School with UDISE code ${normalizedUdise} already exists`);
        error.code = 'DUPLICATE_UDISE_CODE';
        error.status = 409;
        throw error;
      }

      // 3. Create or find administrator user
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.phoneNumber, normalizedPhone));

      let adminUser = existingUser;
      if (!adminUser) {
        const tempPassword = input.admin.password || 'SchoolAdminInitialPass2026!';
        const passwordHash = await hashPassword(tempPassword);
        const [newUser] = await tx
          .insert(users)
          .values({
            fullName: input.admin.fullName.trim(),
            phoneNumber: normalizedPhone,
            passwordHash,
            status: 'ACTIVE',
          })
          .returning();
        adminUser = newUser;
      }

      // 4. Create the school record
      const [newSchool] = await tx
        .insert(schools)
        .values({
          name: input.name.trim(),
          udiseCode: normalizedUdise,
          district: input.district.trim(),
          block: input.block?.trim() || null,
          preferredLanguage: input.preferredLanguage || 'bn',
          timezone: input.timezone || 'Asia/Kolkata',
          status: 'ACTIVE',
        })
        .returning();

      // 5. Create SCHOOL_ADMIN membership
      const [adminMembership] = await tx
        .insert(schoolMemberships)
        .values({
          schoolId: newSchool.id,
          userId: adminUser.id,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        })
        .returning();

      // 6. Create Initial Academic Year if supplied or default current year
      let academicYearRecord = null;
      const yearName = input.academicYear?.name || `${new Date().getFullYear()}`;
      const startDate = input.academicYear?.startDate || `${new Date().getFullYear()}-01-01`;
      const endDate = input.academicYear?.endDate || `${new Date().getFullYear()}-12-31`;

      const [createdYear] = await tx
        .insert(academicYears)
        .values({
          schoolId: newSchool.id,
          name: yearName,
          startDate,
          endDate,
          isCurrent: true,
        })
        .returning();
      academicYearRecord = createdYear;

      // 7. Initialize SMS Settings
      await tx
        .insert(schoolSmsSettings)
        .values({
          schoolId: newSchool.id,
          smsEnabled: true,
          segmentBalance: 1000, // Initial pilot quota
        });

      // 8. Create Audit Log
      await createAuditLog({
        schoolId: newSchool.id,
        actorId,
        action: 'SCHOOL_PROVISIONED',
        resourceType: 'SCHOOL',
        resourceId: newSchool.id,
        metadata: {
          udiseCode: normalizedUdise,
          schoolName: newSchool.name,
          adminUserId: adminUser.id,
          idempotencyKey,
        },
      });

      return {
        school: newSchool,
        adminUser: {
          id: adminUser.id,
          fullName: adminUser.fullName,
          phoneNumber: adminUser.phoneNumber,
          status: adminUser.status,
        },
        adminMembership,
        academicYear: academicYearRecord,
      };
    });
  }

  /**
   * List all schools with filters, search, and pagination.
   */
  static async listSchools(options: SchoolListOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (options.status) {
      conditions.push(eq(schools.status, options.status));
    }
    if (options.district) {
      conditions.push(eq(schools.district, options.district));
    }
    if (options.search) {
      const searchPattern = `%${options.search.trim()}%`;
      conditions.push(
        sql`(${schools.name} ILIKE ${searchPattern} OR ${schools.udiseCode} ILIKE ${searchPattern} OR ${schools.district} ILIKE ${searchPattern})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schools)
      .where(whereClause);

    const schoolList = await db
      .select()
      .from(schools)
      .where(whereClause)
      .orderBy(desc(schools.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      schools: schoolList,
      pagination: {
        page,
        limit,
        total: Number(totalRes?.count || 0),
        totalPages: Math.ceil(Number(totalRes?.count || 0) / limit),
      },
    };
  }

  /**
   * Get single school details including current academic year and admin count.
   */
  static async getSchoolDetails(schoolId: string) {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, schoolId));

    if (!school) {
      const error: any = new Error('School not found');
      error.code = 'SCHOOL_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const [currentYear] = await db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true)));

    const admins = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
        role: schoolMemberships.role,
        status: schoolMemberships.status,
      })
      .from(schoolMemberships)
      .innerJoin(users, eq(schoolMemberships.userId, users.id))
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.role, 'SCHOOL_ADMIN')));

    return {
      school,
      currentAcademicYear: currentYear || null,
      administrators: admins,
    };
  }

  /**
   * Update school status with mandatory reason and audit.
   */
  static async updateSchoolStatus(
    schoolId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
    reason: string,
    actorId: string
  ) {
    if (!reason || reason.trim().length < 5) {
      const error: any = new Error('A detailed reason (at least 5 characters) is mandatory');
      error.code = 'REASON_REQUIRED';
      error.status = 400;
      throw error;
    }

    const [updated] = await db
      .update(schools)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, schoolId))
      .returning();

    if (!updated) {
      const error: any = new Error('School not found');
      error.code = 'SCHOOL_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    await createAuditLog({
      schoolId,
      actorId,
      action: 'SCHOOL_STATUS_CHANGED',
      resourceType: 'SCHOOL',
      resourceId: schoolId,
      metadata: {
        newStatus: status,
        reason: reason.trim(),
      },
    });

    return updated;
  }
}
