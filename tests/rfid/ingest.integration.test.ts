import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { db, withTenantContext } from '../../src/db';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import {
  rfidReaders,
  rfidCredentials,
  rfidScanEvents,
  attendanceSessions,
  attendanceRecords,
  attendanceEvents,
  students,
  enrollments,
  academicYears,
  classSections,
  teacherAssignments,
  schools,
} from '../../src/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { processZebraBatch, clearSchoolSettingsCache } from '../../src/services/rfid/ingest';
import { writeOutcomes } from '../../src/services/rfid/ingest/write';
import type { Outcome } from '../../src/services/rfid/ingest/types';
import { canonicalizeEpc, computeEpcDigest, getEpcLastFour } from '../../src/services/rfid/cryptoService';
import { generateReaderToken } from '../../src/services/rfid/readerTokens';
import * as redisService from '../../src/services/redisService';

interface KidSeed {
  studentId: string;
  epc: string;
  badge1?: string;
  badge2?: string;
}

describe('processZebraBatch (Postgres Integration)', () => {
  let schoolId: string;
  let adminUserId: string;
  let teacherUserId: string;
  let academicYearId: string;
  let classSectionId: string;
  let readerId: string;
  let readerDeviceId: string;
  let bearerToken: string;

  let kidA: KidSeed;
  let kidB: KidSeed;
  let kidC: KidSeed;

  function makeBatch(school: string, epcs: string[]) {
    const data = epcs.map((epc, i) => ({
      idHex: epc,
      antenna: 1,
      peakRssi: -55,
      timestamp: new Date(Date.now() - 1000 + i * 10).toISOString(),
    }));
    const jsonStr = JSON.stringify({ data });
    const rawBody = Buffer.from(jsonStr, 'utf8');
    const parsedBody = JSON.parse(jsonStr);
    const headers = {
      authorization: `Bearer ${bearerToken}`,
      'x-reader-id': readerDeviceId,
    };
    return {
      schoolId: school,
      rawBody,
      parsedBody,
      headers,
    };
  }

  async function ingest(batch: ReturnType<typeof makeBatch>) {
    return processZebraBatch(batch);
  }

  async function dumpAttendance(school: string) {
    return withTenantContext(school, async (tx) => {
      return tx
        .select({
          studentId: attendanceRecords.studentId,
          status: attendanceRecords.status,
          source: attendanceRecords.source,
          needsReview: attendanceRecords.needsReview,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.schoolId, school))
        .orderBy(attendanceRecords.studentId);
    });
  }

  async function countRecords(school: string) {
    const records = await dumpAttendance(school);
    return records.length;
  }

  async function recordFor(school: string, studentId: string) {
    const [rec] = await withTenantContext(school, async (tx) => {
      return tx
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.schoolId, school), eq(attendanceRecords.studentId, studentId)))
        .limit(1);
    });
    return rec;
  }

  async function markManually(school: string, kid: KidSeed, status: string) {
    const schoolDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    await withTenantContext(school, async (tx) => {
      let [sess] = await tx
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.schoolId, school),
            eq(attendanceSessions.classSectionId, classSectionId),
            eq(attendanceSessions.sessionDate, schoolDate),
            eq(attendanceSessions.sessionType, 'GATE_ARRIVAL')
          )
        )
        .limit(1);

      if (!sess) {
        [sess] = await tx
          .insert(attendanceSessions)
          .values({
            schoolId: school,
            classSectionId,
            teacherId: teacherUserId,
            sessionDate: schoolDate,
            sessionType: 'GATE_ARRIVAL',
            status: 'OPEN',
          })
          .returning();
      }

      await tx
        .insert(attendanceRecords)
        .values({
          schoolId: school,
          attendanceSessionId: sess.id,
          studentId: kid.studentId,
          status,
          source: 'MANUAL',
          captureMethod: 'MANUAL',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.attendanceSessionId, attendanceRecords.studentId],
          set: {
            status,
            source: 'MANUAL',
            captureMethod: 'MANUAL',
            lastUpdatedAt: new Date(),
          },
        });
    });
  }

  async function suspendStudent(school: string, kid: KidSeed) {
    await withTenantContext(school, async (tx) => {
      await tx
        .update(students)
        .set({ status: 'INACTIVE' })
        .where(and(eq(students.schoolId, school), eq(students.id, kid.studentId)));
    });
  }

  async function reactivateStudent(school: string, kid: KidSeed) {
    await withTenantContext(school, async (tx) => {
      await tx
        .update(students)
        .set({ status: 'ACTIVE' })
        .where(and(eq(students.schoolId, school), eq(students.id, kid.studentId)));
    });
  }

  let nextRollNumber = 2000;

  async function seedKids(school: string, count: number): Promise<KidSeed[]> {
    return withTenantContext(school, async (tx) => {
      const studentValues = Array.from({ length: count }, (_, i) => ({
        schoolId: school,
        name: `Gate Rush Student ${i + 1}`,
        studentCode: `RUSH-${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'ACTIVE',
      }));

      const createdStudents = await tx.insert(students).values(studentValues).returning({ id: students.id });

      const enrollmentValues = createdStudents.map((s: { id: string }) => ({
        schoolId: school,
        studentId: s.id,
        classSectionId,
        academicYearId,
        rollNumber: nextRollNumber++,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      }));
      await tx.insert(enrollments).values(enrollmentValues);

      const seededKids: KidSeed[] = [];
      const credValues = createdStudents.map((s: { id: string }, idx: number) => {
        const epc = `E2801170${String(Date.now()).slice(-8)}${String(idx).padStart(8, '0')}`;
        seededKids.push({ studentId: s.id, epc });
        return {
          schoolId: school,
          studentId: s.id,
          credentialType: 'UHF_EPC_GEN2',
          credentialDigest: computeEpcDigest(canonicalizeEpc(epc), school),
          epcLastFour: getEpcLastFour(epc),
          status: 'ACTIVE' as const,
          securityMode: 'UHF_EPC' as const,
          keyVersion: 1,
          createdByUserId: adminUserId,
        };
      });
      await tx.insert(rfidCredentials).values(credValues);

      return seededKids;
    });
  }

  function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.RFID_INGEST_V2 = 'true';
    process.env.SMS_PROVIDER = 'console';

    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;
    teacherUserId = seeded.teacherUser.id;

    await withTenantContext(schoolId, async (tx) => {
      await tx.update(schools).set({ rfidMode: 'LIVE' }).where(eq(schools.id, schoolId));
    });
    clearSchoolSettingsCache(schoolId);

    // Academic Year
    const [ay] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true)))
        .limit(1);
    });
    academicYearId = ay.id;

    // Class Section
    const [sec] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(classSections)
        .where(and(eq(classSections.schoolId, schoolId), eq(classSections.className, 'Class 5')))
        .limit(1);
    });
    classSectionId = sec.id;

    // Teacher assignment
    await withTenantContext(schoolId, async (tx) => {
      await tx
        .insert(teacherAssignments)
        .values({
          schoolId,
          teacherId: teacherUserId,
          classSectionId,
        })
        .onConflictDoNothing();
    });

    // Register test reader
    readerDeviceId = `FX9600-GATE-${Date.now()}`;
    const tokenObj = generateReaderToken();
    bearerToken = tokenObj.token;

    const registered = await readerService.registerReader({
      schoolId,
      deviceId: readerDeviceId,
      name: 'Main Gate Ingest V2 Reader',
      adapterType: 'NETWORK',
      securityCapability: 'ZEBRA_FX9600',
    });
    await readerService.approveReader(registered.id, schoolId);
    readerId = registered.id;

    await withTenantContext(schoolId, async (tx) => {
      await tx
        .update(rfidReaders)
        .set({ bearerTokenHash: tokenObj.hash })
        .where(eq(rfidReaders.id, readerId));
    });

    // Seed kids A, B, C
    const [k1, k2, k3] = await seedKids(schoolId, 3);
    kidA = k1;
    kidB = k2;
    kidC = k3;

    // Give kidA a second badge
    const badge2Epc = `E2801170BADE22${String(Date.now()).slice(-8)}`;
    kidA.badge1 = kidA.epc;
    kidA.badge2 = badge2Epc;

    await withTenantContext(schoolId, async (tx) => {
      await tx.insert(rfidCredentials).values({
        schoolId,
        studentId: kidA.studentId,
        credentialType: 'UHF_EPC_GEN2',
        credentialDigest: computeEpcDigest(canonicalizeEpc(badge2Epc), schoolId),
        epcLastFour: getEpcLastFour(badge2Epc),
        status: 'ACTIVE',
        securityMode: 'UHF_EPC',
        keyVersion: 1,
        createdByUserId: adminUserId,
      });
    });
  });

  beforeEach(async () => {
    // Clear attendance records and sessions for clean test state
    await withTenantContext(schoolId, async (tx) => {
      await tx.delete(attendanceEvents).where(eq(attendanceEvents.schoolId, schoolId));
      await tx.delete(rfidScanEvents).where(eq(rfidScanEvents.schoolId, schoolId));
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.schoolId, schoolId));
      await tx.delete(attendanceSessions).where(eq(attendanceSessions.schoolId, schoolId));
    });
  });

  it('is idempotent: replaying a batch changes nothing', async () => {
    const batch = makeBatch(schoolId, [kidA.epc, kidB.epc, kidC.epc]);
    const r1 = await ingest(batch);
    expect(r1.acceptedCount).toBe(3);
    expect(r1.processedCount).toBe(3);
    expect(r1.results.every((x) => x.decision === 'ACCEPTED')).toBe(true);

    const snapshot = await dumpAttendance(schoolId);
    expect(snapshot).toHaveLength(3);

    // Replay batch (testing idempotency in DB when debounce is cleared or replayed)
    const r2 = await ingest(batch);
    expect(r2.results.every((x) => x.decision === 'ALREADY_PRESENT' || x.decision === 'DUPLICATE_DEBOUNCED')).toBe(true);
    expect(await dumpAttendance(schoolId)).toEqual(snapshot);
  });

  it('never overwrites a teacher manual mark', async () => {
    await markManually(schoolId, kidA, 'ABSENT');
    const r = await ingest(makeBatch(schoolId, [kidA.epc]));
    expect(r.results[0].decision).toBe('MANUAL_OVERRIDE_PRESERVED');
    const rec = await recordFor(schoolId, kidA.studentId);
    expect(rec?.status).toBe('ABSENT');
    expect(rec?.source).toBe('MANUAL');
  });

  it('two badges, one student, one batch → one record, no error', async () => {
    const batch = makeBatch(schoolId, [kidA.badge1!, kidA.badge2!]);
    const r = await ingest(batch);
    const decisions = r.results.map((x) => x.decision).sort();
    expect(decisions).toEqual(['ACCEPTED', 'ALREADY_PRESENT']);

    const records = await dumpAttendance(schoolId);
    expect(records).toHaveLength(1);
    expect(records[0].studentId).toBe(kidA.studentId);
  });

  it('4 overlapping concurrent batches: no deadlock, exactly one record per kid', async () => {
    const testKids = await seedKids(schoolId, 60);
    const batches = [0, 1, 2, 3].map(() =>
      makeBatch(schoolId, shuffle(testKids).slice(0, 40).map((k) => k.epc))
    );

    const results = await Promise.allSettled(batches.map(ingest));
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('Batch failed with error:', r.reason);
      }
    }
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const allSentEpcs = new Set(batches.flatMap((b) => b.parsedBody.data.map((d: any) => d.idHex)));
    const totalRecords = await countRecords(schoolId);
    expect(totalRecords).toBe(allSentEpcs.size);
  });

  it('Redis down → still correct', async () => {
    const spy = vi.spyOn(redisService, 'getRedisClient').mockReturnValue(null as any);
    try {
      const batch = makeBatch(schoolId, [kidB.epc]);
      const r = await ingest(batch);
      expect(r.acceptedCount).toBe(1);
      const rec = await recordFor(schoolId, kidB.studentId);
      expect(rec?.status).toBe('PRESENT');
    } finally {
      spy.mockRestore();
    }
  });

  it('rejected read does not debounce the tag', async () => {
    await suspendStudent(schoolId, kidC);
    const r1 = await ingest(makeBatch(schoolId, [kidC.epc]));
    expect(r1.results[0].decision).toBe('STUDENT_INACTIVE');

    await reactivateStudent(schoolId, kidC);
    const r2 = await ingest(makeBatch(schoolId, [kidC.epc]));
    expect(r2.results[0].decision).toBe('ACCEPTED');
  });

  it('never reports ACCEPTED for a read that was not written (downgrades to NO_ACTIVE_SESSION)', async () => {
    await withTenantContext(schoolId, async (tx) => {
      const orphanOutcome: Outcome = {
        index: 0,
        read: {
          index: 0,
          epcDigest: computeEpcDigest(canonicalizeEpc(kidA.epc), schoolId),
          epcLast4: getEpcLastFour(kidA.epc),
          tidDigest: null,
          antenna: 1,
          rssi: -50,
          readAt: new Date(),
          timeSource: 'READER',
          freshness: 'OK',
          idempotencyKey: 'test-orphan-key-1',
        },
        decision: 'ACCEPTED',
        studentId: kidA.studentId,
        classSectionId: '11111111-2222-3333-4444-555555555555',
        needsSession: false,
      };

      const ctx: any = {
        schoolId,
        schoolDate: '2026-03-30',
        sessionBySection: new Map(),
        teacherBySection: new Map(),
      };

      const results = await writeOutcomes(tx, ctx, [orphanOutcome], { id: readerId });
      expect(results[0].decision).toBe('NO_ACTIVE_SESSION');
    });

    const rec = await recordFor(schoolId, kidA.studentId);
    expect(rec).toBeUndefined();
  });

  it('records actorType as READER in attendance_events on RFID ingest', async () => {
    const batch = makeBatch(schoolId, [kidA.epc]);
    const r = await ingest(batch);
    expect(r.acceptedCount).toBe(1);

    const [event] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceEvents)
        .where(eq(attendanceEvents.schoolId, schoolId))
        .limit(1);
    });

    expect(event).toBeDefined();
    expect(event.actorType).toBe('READER');
    expect(event.actorId).toBeNull();
    expect(event.actorReaderId).toBe(readerId);
  });
});
