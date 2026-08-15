import { describe, it, expect, beforeEach } from 'vitest';
import { computeSHA256 } from '../src/services/offlineSyncService';
import { verifyCsrfToken, generateCsrfToken } from '../src/middleware/csrfProtection';
import { db, withSystemContext, withTenantContext } from '../src/db/index';
import { runMigrations } from '../src/db/migrate';
import {
  schools,
  academicYears,
  classSections,
  students,
  enrollments,
  users,
  schoolMemberships,
  teacherAssignments,
  attendanceSessions,
  attendanceRecords,
  attendanceEvents,
} from '../src/db/schema';
import {
  createAttendanceSession,
  processQRCode,
  updateSessionStatus,
} from '../src/services/attendanceService';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('WP1 & WP2 — Teacher Loop, Cryptographic Digests & Sync Integrity', () => {
  beforeEach(async () => {
    await runMigrations();
  });

  describe('Cryptographic Token Hashing (computeSHA256)', () => {
    it('computes exact canonical SHA-256 hex digest across formats', async () => {
      const input = 'STUDENT_QR_TOKEN_BENGAL_2026_001';
      const expectedSha256 = crypto.createHash('sha256').update(input).digest('hex');

      const computed = await computeSHA256(input);
      expect(computed).toBe(expectedSha256);
      expect(computed).toHaveLength(64);
    });
  });

  describe('CSRF Protection & Fail-Closed Guardrails', () => {
    it('generates session-bound CSRF token and verifies valid session signature', () => {
      const sessionToken = 'authenticated-session-uuid-12345';
      const { token, signature } = generateCsrfToken(sessionToken);

      expect(verifyCsrfToken(token, signature, sessionToken)).toBe(true);
    });

    it('rejects CSRF token when session signature is forged or mismatched', () => {
      const sessionTokenA = 'session-user-a';
      const sessionTokenB = 'session-user-b';
      const { token, signature } = generateCsrfToken(sessionTokenA);

      // Attempting to use Token A signature with Session B must fail
      expect(verifyCsrfToken(token, signature, sessionTokenB)).toBe(false);
    });

    it('rejects raw/unsigned tokens when session is present', () => {
      const sessionToken = 'authenticated-session-user';
      const { token } = generateCsrfToken(); // Unsigned/raw token
      const rawSignature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'attendance-dev-csrf-hmac-master-secret-key-32b-min').update(token).digest('hex');

      // Unauthenticated signature must be rejected once session exists
      expect(verifyCsrfToken(token, rawSignature, sessionToken)).toBe(false);
    });
  });

  describe('Teacher Assignment Access Control & Attendance Transactions', () => {
    it('rejects session creation when teacher is not assigned to the class section', async () => {
      const [school] = await db
        .insert(schools)
        .values({
          name: 'Sundarbans Primary School',
          slug: `sundarbans-${Date.now()}`,
          district: 'South 24 Parganas',
          status: 'ACTIVE',
        })
        .returning();

      let teacherId = '';
      let unassignedClassId = '';

      await withTenantContext(school.id, async (tx) => {
        const [ay] = await tx
          .insert(academicYears)
          .values({
            schoolId: school.id,
            name: 'AY 2026',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            isCurrent: true,
          })
          .returning();

        const [cs] = await tx
          .insert(classSections)
          .values({
            schoolId: school.id,
            academicYearId: ay.id,
            className: 'Class 4',
            sectionName: 'A',
            medium: 'BENGALI',
          })
          .returning();
        unassignedClassId = cs.id;

        const [u] = await tx
          .insert(users)
          .values({
            phoneNumber: `+9198${Date.now().toString().slice(-8)}`,
            passwordHash: 'dummy-hash',
            fullName: 'Soumen Roy',
            role: 'TEACHER',
            status: 'ACTIVE',
          })
          .returning();
        teacherId = u.id;

        await tx.insert(schoolMemberships).values({
          schoolId: school.id,
          userId: u.id,
          role: 'TEACHER',
          status: 'ACTIVE',
        });
      });

      // Teacher attempting to create session for unassigned class must fail
      await expect(
        createAttendanceSession({
          schoolId: school.id,
          classSectionId: unassignedClassId,
          teacherId,
          sessionDate: '2026-08-15',
          actorId: teacherId,
          userRole: 'TEACHER',
        })
      ).rejects.toThrow('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
    });

    it('finalizes session and auto-marks unmarked students as ABSENT transactionally', async () => {
      const [school] = await db
        .insert(schools)
        .values({
          name: 'Bankura Girls High School',
          slug: `bankura-${Date.now()}`,
          district: 'Bankura',
          status: 'ACTIVE',
        })
        .returning();

      let teacherId = '';
      let classSectionId = '';
      let student1Id = '';
      let student2Id = '';

      await withTenantContext(school.id, async (tx) => {
        const [ay] = await tx
          .insert(academicYears)
          .values({
            schoolId: school.id,
            name: 'AY 2026',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            isCurrent: true,
          })
          .returning();

        const [cs] = await tx
          .insert(classSections)
          .values({
            schoolId: school.id,
            academicYearId: ay.id,
            className: 'Class 8',
            sectionName: 'B',
            medium: 'BENGALI',
          })
          .returning();
        classSectionId = cs.id;

        const [u] = await tx
          .insert(users)
          .values({
            phoneNumber: `+9197${Date.now().toString().slice(-8)}`,
            passwordHash: 'dummy-hash',
            fullName: 'Moumita Sen',
            role: 'TEACHER',
            status: 'ACTIVE',
          })
          .returning();
        teacherId = u.id;

        await tx.insert(schoolMemberships).values({
          schoolId: school.id,
          userId: u.id,
          role: 'TEACHER',
          status: 'ACTIVE',
        });

        await tx.insert(teacherAssignments).values({
          schoolId: school.id,
          teacherId: u.id,
          classSectionId: cs.id,
          academicYearId: ay.id,
        });

        const [s1] = await tx
          .insert(students)
          .values({
            schoolId: school.id,
            studentCode: 'BNK-001',
            name: 'Koyel Ghosh',
            nameBn: 'কোয়েল ঘোষ',
            gender: 'FEMALE',
            status: 'ACTIVE',
          })
          .returning();
        student1Id = s1.id;

        const [s2] = await tx
          .insert(students)
          .values({
            schoolId: school.id,
            studentCode: 'BNK-002',
            name: 'Priyanka Das',
            nameBn: 'প্রিয়াঙ্কা দাস',
            gender: 'FEMALE',
            status: 'ACTIVE',
          })
          .returning();
        student2Id = s2.id;

        await tx.insert(enrollments).values([
          {
            schoolId: school.id,
            studentId: s1.id,
            classSectionId: cs.id,
            academicYearId: ay.id,
            rollNumber: 1,
            startDate: '2026-01-01',
            status: 'ACTIVE',
          },
          {
            schoolId: school.id,
            studentId: s2.id,
            classSectionId: cs.id,
            academicYearId: ay.id,
            rollNumber: 2,
            startDate: '2026-01-01',
            status: 'ACTIVE',
          },
        ]);
      });

      // 1. Teacher creates session
      const sessionResult = await createAttendanceSession({
        schoolId: school.id,
        classSectionId,
        teacherId,
        sessionDate: '2026-08-15',
        actorId: teacherId,
        userRole: 'TEACHER',
      });
      const sessionId = sessionResult.session.id;

      // 2. Mark Student 1 PRESENT via MANUAL status update
      await db.transaction(async (tx: any) => {
        await tx.insert(attendanceEvents).values({
          schoolId: school.id,
          clientEventId: `scan-${Date.now()}-1`,
          attendanceSessionId: sessionId,
          studentId: student1Id,
          eventType: 'QR_SCANNED',
          statusValue: 'PRESENT',
          clientTimestamp: new Date(),
          serverReceivedAt: new Date(),
          actorId: teacherId,
        });

        await tx
          .update(attendanceRecords)
          .set({ status: 'PRESENT', firstScannedAt: new Date(), lastUpdatedAt: new Date() })
          .where(
            and(
              eq(attendanceRecords.attendanceSessionId, sessionId),
              eq(attendanceRecords.studentId, student1Id)
            )
          );
      });

      // 3. Finalize session with autoMarkAbsentForUnmarked = true
      const finalized = await updateSessionStatus({
        schoolId: school.id,
        sessionId,
        actorId: teacherId,
        userRole: 'TEACHER',
        newStatus: 'FINALIZED',
        autoMarkAbsentForUnmarked: true,
      });

      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.finalizedAt).toBeDefined();

      // 4. Verify records: Student 1 is PRESENT, Student 2 is auto-marked ABSENT
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.attendanceSessionId, sessionId));

      const r1 = records.find((r: any) => r.studentId === student1Id);
      const r2 = records.find((r: any) => r.studentId === student2Id);

      expect(r1?.status).toBe('PRESENT');
      expect(r2?.status).toBe('ABSENT');

      // 5. Verify session locking: further status updates on finalized session must be rejected
      await expect(
        updateSessionStatus({
          schoolId: school.id,
          sessionId,
          actorId: teacherId,
          userRole: 'TEACHER',
          newStatus: 'OPEN',
        })
      ).rejects.toThrow('FINALIZED_SESSION_LOCKED');
    });
  });
});
