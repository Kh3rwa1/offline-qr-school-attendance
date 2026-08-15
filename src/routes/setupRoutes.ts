import { Router, Request, Response } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { db, withTenantContext } from '../db';
import { users, schools, schoolMemberships, academicYears, classSections, students, enrollments, auditLogs } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/authMiddleware';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';

export const setupRouter = Router();

const initializeSchema = z.object({
  admin: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Phone number must be valid E.164 format (e.g. +919876543210)'),
    password: z.string().min(12, 'Password must be at least 12 characters'),
  }),
  school: z
    .object({
      name: z.string().min(2, 'School name must be at least 2 characters').max(255),
      slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens').optional(),
      district: z.string().min(2, 'District must be at least 2 characters').max(100),
      udiseCode: z.string().max(50).optional(),
      preferredLanguage: z.enum(['bn', 'en']).default('bn'),
    })
    .optional(),
});

const rosterRowSchema = z.object({
  studentName: z.string().min(2, 'Student name is required').max(100),
  rollNumber: z.coerce.number().int().positive('Roll number must be a positive integer'),
  className: z.string().min(1, 'Class name is required').max(50),
  sectionName: z.string().max(50).default('A'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('OTHER'),
  guardianPhone: z.string().optional(),
});

const importRosterSchema = z.object({
  schoolId: z.string().uuid('Invalid school ID'),
  records: z.array(rosterRowSchema).min(1, 'At least one student record is required'),
});

// Helper: Check whether system is already bootstrapped with a Super Admin
export async function isSystemBootstrapped(): Promise<boolean> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.platformRole, 'SUPER_ADMIN'))
    .limit(1);
  return Boolean(admin);
}

// 1. GET /api/v1/setup/status
setupRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const bootstrapped = await isSystemBootstrapped();

    // Check subsystem health for setup diagnostics
    let dbStatus = 'connected';
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'disconnected';
    }

    const backupConfigured = Boolean(process.env.BACKUP_ENCRYPTION_KEY && process.env.BACKUP_ENCRYPTION_KEY.length >= 32);
    const r2Configured = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
    const smsConfigured = Boolean(process.env.SMS_PROVIDER && process.env.SMS_PROVIDER !== 'fake');

    let workerAlive = false;
    const heartbeatFile = process.env.WORKER_HEARTBEAT_FILE || '/tmp/worker-heartbeat';
    try {
      if (fs.existsSync(heartbeatFile)) {
        const stats = fs.statSync(heartbeatFile);
        workerAlive = Date.now() - stats.mtimeMs < 120_000;
      }
    } catch {}

    res.status(200).json({
      isBootstrapped: bootstrapped,
      setupAllowed: !bootstrapped,
      systemInfo: {
        dbStatus,
        backupConfigured,
        r2Configured,
        smsConfigured,
        smsProvider: process.env.SMS_PROVIDER || 'console',
        workerAlive,
        serverDomain: process.env.SERVER_DOMAIN || 'localhost',
        featureRfid: process.env.FEATURE_RFID === 'true',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'FAILED_SETUP_STATUS', message: err.message });
  }
});

// 2. POST /api/v1/setup/initialize
setupRouter.post('/initialize', rateLimitPolicies.setup, async (req: Request, res: Response) => {
  try {
    const bootstrapped = await isSystemBootstrapped();
    if (bootstrapped) {
      return res.status(403).json({
        error: 'SETUP_ALREADY_COMPLETED',
        message: 'System initialization has already been completed. Further setup requests are permanently disabled.',
      });
    }

    const parsed = initializeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      });
    }

    const { admin, school: schoolInput } = parsed.data;

    // Check if phone number already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, admin.phoneNumber));

    if (existing) {
      return res.status(409).json({
        error: 'PHONE_NUMBER_EXISTS',
        message: `A user with phone number '${admin.phoneNumber}' already exists.`,
      });
    }

    // Hash password using Argon2id with production parameters
    const passwordHash = await argon2.hash(admin.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    let createdUserId: string;
    let createdSchoolId: string | null = null;

    await db.transaction(async (tx: any) => {
      // 1. Create Super Admin User
      const [newUser] = await tx
        .insert(users)
        .values({
          fullName: admin.fullName,
          phoneNumber: admin.phoneNumber,
          passwordHash,
          platformRole: 'SUPER_ADMIN',
          status: 'ACTIVE',
        })
        .returning({ id: users.id });

      createdUserId = newUser.id;

      // 2. If school details provided, create initial school
      if (schoolInput) {
        const slug =
          schoolInput.slug ||
          schoolInput.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') ||
          `school-${crypto.randomBytes(3).toString('hex')}`;

        const [newSchool] = await tx
          .insert(schools)
          .values({
            name: schoolInput.name,
            slug,
            district: schoolInput.district,
            udiseCode: schoolInput.udiseCode || null,
            preferredLanguage: schoolInput.preferredLanguage,
            status: 'ACTIVE',
          })
          .returning({ id: schools.id });

        createdSchoolId = newSchool.id;

        // Assign user as SUPER_ADMIN of the new school
        await tx.insert(schoolMemberships).values({
          schoolId: newSchool.id,
          userId: newUser.id,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        });

        // Create initial current academic year
        const currentYear = new Date().getFullYear();
        await tx.insert(academicYears).values({
          schoolId: newSchool.id,
          name: `AY ${currentYear}-${currentYear + 1}`,
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-12-31`,
          isCurrent: true,
        });
      }

      // 3. Record Audit Log
      await tx.insert(auditLogs).values({
        schoolId: createdSchoolId || null,
        actorId: newUser.id,
        action: 'SYSTEM_INITIALIZED',
        resourceType: 'SETUP',
        resourceId: newUser.id,
        metadata: {
          adminPhone: admin.phoneNumber,
          hasSchool: Boolean(schoolInput),
          schoolId: createdSchoolId,
          timestamp: new Date().toISOString(),
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'System initialization successfully completed. The setup endpoint is now permanently locked.',
      userId: createdUserId!,
      schoolId: createdSchoolId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INITIALIZATION_FAILED', message: err.message });
  }
});

// 3. POST /api/v1/setup/import-roster
setupRouter.post('/import-roster', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const session = authReq.sessionContext;
    const isSuperAdmin = session?.platformRole === 'SUPER_ADMIN' || session?.user?.platformRole === 'SUPER_ADMIN';
    const isSchoolAdmin = session?.activeMembership?.role === 'SCHOOL_ADMIN' || session?.memberships?.some((m: any) => m.role === 'SCHOOL_ADMIN');

    if (!isSuperAdmin && !isSchoolAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Super Administrators or School Administrators can import rosters.' });
    }

    const parsed = importRosterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
    }

    const { schoolId, records } = parsed.data;

    // Verify school exists
    const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId));
    if (!school) {
      return res.status(404).json({ error: 'SCHOOL_NOT_FOUND', message: 'Specified school workspace does not exist.' });
    }

    let insertedCount = 0;
    const classMap = new Map<string, string>(); // 'className-section' -> classSectionId

    await withTenantContext(schoolId, async (tx) => {
      // Find or create current academic year
      let [currentAy] = await tx
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(eq(academicYears.schoolId, schoolId))
        .limit(1);

      if (!currentAy) {
        const year = new Date().getFullYear();
        const [createdAy] = await tx
          .insert(academicYears)
          .values({
            schoolId,
            name: `AY ${year}-${year + 1}`,
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`,
            isCurrent: true,
          })
          .returning({ id: academicYears.id });
        currentAy = createdAy;
      }

      for (const row of records) {
        const classKey = `${row.className}-${row.sectionName}`;
        let classSectionId = classMap.get(classKey);

        if (!classSectionId) {
          // Check if exists
          const [existingClass] = await tx
            .select({ id: classSections.id })
            .from(classSections)
            .where(
              sql`${classSections.schoolId} = ${schoolId} AND ${classSections.className} = ${row.className} AND ${classSections.sectionName} = ${row.sectionName}`
            );

          if (existingClass) {
            classSectionId = existingClass.id;
          } else {
            const [newClass] = await tx
              .insert(classSections)
              .values({
                schoolId,
                academicYearId: currentAy.id,
                className: row.className,
                sectionName: row.sectionName,
                medium: 'BENGALI',
              })
              .returning({ id: classSections.id });
            classSectionId = newClass.id;
          }
          classMap.set(classKey, classSectionId as string);
        }

        // Generate student code
        const studentCode = `STU-${row.className.replace(/\s+/g, '')}-${row.sectionName}-${row.rollNumber}`;

        // Create student
        const [newStudent] = await tx
          .insert(students)
          .values({
            schoolId,
            studentCode,
            name: row.studentName,
            gender: row.gender,
            guardianPhone: row.guardianPhone || null,
            status: 'ACTIVE',
          })
          .returning({ id: students.id });

        // Create enrollment
        await tx.insert(enrollments).values({
          schoolId,
          studentId: newStudent.id,
          classSectionId: (classSectionId || classMap.get(classKey)) as string,
          academicYearId: currentAy.id,
          rollNumber: row.rollNumber,
          startDate: new Date().toISOString().split('T')[0],
          status: 'ACTIVE',
        });

        insertedCount++;
      }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${insertedCount} students across ${classMap.size} classes.`,
      enrolledCount: insertedCount,
      classesCreated: classMap.size,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'IMPORT_FAILED', message: err.message });
  }
});
