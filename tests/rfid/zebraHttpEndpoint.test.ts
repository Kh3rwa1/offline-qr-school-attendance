import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { rfidRouter } from '../../src/routes/rfidRoutes';
import { db, withTenantContext } from '../../src/db';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import {
  rfidReaders,
  rfidCredentials,
  attendanceSessions,
  attendanceRecords,
  students,
  enrollments,
  academicYears,
  classSections,
  teacherAssignments,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  canonicalizeEpc,
  computeEpcDigest,
  getEpcLastFour,
} from '../../src/services/rfid/cryptoService';

function dispatchRfidRoute(
  schoolId: string,
  options: {
    method?: string;
    path?: string;
    headers: Record<string, string>;
    body: any;
    rawBody?: Buffer;
  }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const rawBodyBuf =
      options.rawBody ||
      Buffer.from(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    const parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    const headersLower: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers)) {
      headersLower[k.toLowerCase()] = v;
    }
    const path = options.path || `/${schoolId}/rfid/zebra/reads`;
    const req: any = {
      method: options.method || 'POST',
      url: path,
      originalUrl: path,
      params: { schoolId },
      headers: headersLower,
      get: (k: string) => headersLower[k.toLowerCase()],
      header: (k: string) => headersLower[k.toLowerCase()],
      body: parsedBody,
      rawBody: rawBodyBuf,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res: any = {
      statusCode: 200,
      headers: {},
      setHeader(k: string, v: string) {
        this.headers[k.toLowerCase()] = v;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: this.body });
        return this;
      },
      send(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: this.body });
        return this;
      },
    };
    (rfidRouter as any).handle(req, res, (err: any) => {
      if (err) resolve({ status: 500, body: { error: err.message } });
      else resolve({ status: 404, body: { error: 'NOT_FOUND' } });
    });
  });
}

describe('HTTP API /api/v1/schools/:schoolId/rfid/zebra/reads Ingest Suite', () => {
  let schoolId: string;
  let adminUserId: string;
  let teacherUserId: string;
  const testReaderDeviceId = 'FX9600-HTTP-01';
  let testReaderId: string;
  let testStudentId: string;
  let testClassSectionId: string;
  let testAcademicYearId: string;
  const testEpc = 'E28011700000020B85794820';
  const testEpcDigest = computeEpcDigest(testEpc);
  const hmacSecret = 'test-secret-32-chars-length-environment';

  let otherSchoolId: string;

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = hmacSecret;
    process.env.FEATURE_RFID = 'true';
    process.env.SMS_PROVIDER = 'console';
    process.env.NODE_ENV = 'test';

    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;
    otherSchoolId = seeded.schoolB.id;
    adminUserId = seeded.adminUser.id;
    teacherUserId = seeded.teacherUser.id;

    // Get current Academic Year
    const [ay] = await withTenantContext(schoolId, async (tx) => {
      return tx.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))).limit(1);
    });
    testAcademicYearId = ay.id;

    // Get seeded class section (Class 5 Section A)
    const [sec] = await withTenantContext(schoolId, async (tx) => {
      return tx.select().from(classSections).where(and(eq(classSections.schoolId, schoolId), eq(classSections.className, 'Class 5'))).limit(1);
    });
    testClassSectionId = sec.id;

    // Ensure teacher assignment exists
    await withTenantContext(schoolId, async (tx) => {
      await tx
        .insert(teacherAssignments)
        .values({
          schoolId,
          teacherId: teacherUserId,
          classSectionId: testClassSectionId,
        })
        .onConflictDoNothing();
    });

    // Create test student
    const [st] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .insert(students)
        .values({
          schoolId,
          name: 'HTTP Test Student',
          studentCode: 'ZG-STD-HTTP-01',
          status: 'ACTIVE',
        })
        .returning();
    });
    testStudentId = st.id;

    // Active enrollment
    await withTenantContext(schoolId, async (tx) => {
      await tx.insert(enrollments).values({
        schoolId,
        studentId: testStudentId,
        classSectionId: testClassSectionId,
        academicYearId: testAcademicYearId,
        rollNumber: 201,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });
    });

    // Register & approve FX9600 reader
    const reader = await readerService.registerReader({
      schoolId,
      deviceId: testReaderDeviceId,
      name: 'South Gate Turnstile 1',
      adapterType: 'NETWORK',
      securityCapability: 'ZEBRA_FX9600',
      sharedSecret: hmacSecret,
    });
    const approved = await readerService.approveReader(reader.id, schoolId);
    testReaderId = approved.id;

    // Enroll EPC credential
    const cred = await credentialService.enrollCredential({
      schoolId,
      studentId: testStudentId,
      credentialDigest: testEpcDigest,
      securityMode: 'UHF_EPC',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId, adminUserId);
  });

  it('HTTP POST: Builds raw JSON, signs bytes, ingests, and creates exactly one PRESENT attendance record', async () => {
    const payload = {
      type: 'tag_read',
      reader_name: testReaderDeviceId,
      data: [
        {
          idHex: testEpc,
          antenna: 1,
          peakRssi: -54,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacSecret).update(rawBody, 'utf8').digest('hex');

    // 1. Initial Ingest via HTTP endpoint
    const res1 = await dispatchRfidRoute(schoolId, {
      headers: {
        'Content-Type': 'application/json',
        'x-reader-id': testReaderDeviceId,
        'x-zebra-signature': signature,
      },
      body: payload,
      rawBody: Buffer.from(rawBody),
    });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.acceptedCount).toBe(1);
    expect(res1.body.results[0].decision).toBe('ACCEPTED');
    expect(res1.body.results[0].studentId).toBe(testStudentId);

    // Verify exactly one PRESENT record in database
    const records = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.studentId, testStudentId)
          )
        );
    });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('PRESENT');
    expect(records[0].captureMethod).toBe('RFID_GATE');

    // 2. Sequential Repost of the exact same request
    const res2 = await dispatchRfidRoute(schoolId, {
      headers: {
        'Content-Type': 'application/json',
        'x-reader-id': testReaderDeviceId,
        'x-zebra-signature': signature,
      },
      body: payload,
      rawBody: Buffer.from(rawBody),
    });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.duplicateCount).toBe(1);
    expect(res2.body.acceptedCount).toBe(0);

    // Confirm no duplicate attendance records created
    const recordsAfterRepost = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.studentId, testStudentId)
          )
        );
    });
    expect(recordsAfterRepost).toHaveLength(1);
  });

  it('HTTP POST: 25 Concurrent identical deliveries resolve to exactly 1 PRESENT record with zero race errors', async () => {
    // Create new student for concurrency drill
    const concEpc = 'E28011700000020B85797788';
    const concDigest = computeEpcDigest(concEpc);
    let concStudentId: string;

    await withTenantContext(schoolId, async (tx) => {
      const [st] = await tx
        .insert(students)
        .values({
          schoolId,
          name: 'Concurrent Drill Student',
          studentCode: 'ZG-STD-CONC-01',
          status: 'ACTIVE',
        })
        .returning();
      concStudentId = st.id;

      await tx.insert(enrollments).values({
        schoolId,
        studentId: concStudentId,
        classSectionId: testClassSectionId,
        academicYearId: testAcademicYearId,
        rollNumber: 202,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });

      await tx.insert(rfidCredentials).values({
        schoolId,
        studentId: concStudentId,
        credentialDigest: concDigest,
        securityMode: 'UHF_EPC',
        keyVersion: 1,
        status: 'ACTIVE',
        createdByUserId: adminUserId,
      });
    });

    const payload = {
      type: 'tag_read',
      reader_name: testReaderDeviceId,
      data: [
        {
          idHex: concEpc,
          antenna: 2,
          peakRssi: -58,
          timestamp: new Date().toISOString(),
          vendorEventId: `vendor-event-conc-${Date.now()}`,
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacSecret).update(rawBody, 'utf8').digest('hex');

    // Fire 25 concurrent HTTP requests
    const promises = Array.from({ length: 25 }, () =>
      dispatchRfidRoute(schoolId, {
        headers: {
          'Content-Type': 'application/json',
          'x-reader-id': testReaderDeviceId,
          'x-zebra-signature': signature,
        },
        body: payload,
        rawBody: Buffer.from(rawBody),
      })
    );

    const responses = await Promise.all(promises);

    // All 25 must return HTTP 200
    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    }

    // Exactly 1 must have acceptedCount = 1; the rest 24 duplicateCount = 1
    const totalAccepted = responses.reduce((acc, r) => acc + r.body.acceptedCount, 0);
    const totalDuplicates = responses.reduce((acc, r) => acc + r.body.duplicateCount, 0);

    expect(totalAccepted).toBe(1);
    expect(totalDuplicates).toBe(24);

    // Verify DB invariant: exactly one record exists for concStudentId
    const records = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.studentId, concStudentId)
          )
        );
    });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('PRESENT');
  });

  it('HTTP POST: Cross-tenant isolation rejects webhook from reader belonging to another school', async () => {
    // School B (otherSchoolId seeded in beforeAll)
    const payload = {
      type: 'tag_read',
      reader_name: testReaderDeviceId,
      data: [{ idHex: testEpc }],
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacSecret).update(rawBody, 'utf8').digest('hex');

    const res = await dispatchRfidRoute(otherSchoolId, {
      path: `/${otherSchoolId}/rfid/zebra/reads`,
      headers: {
        'Content-Type': 'application/json',
        'x-reader-id': testReaderDeviceId,
        'x-zebra-signature': signature,
      },
      body: payload,
      rawBody: Buffer.from(rawBody),
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED_READER');
  });

  it('Fail-Closed: Reader without its own provisioned secret cannot authenticate via global secret fallback', async () => {
    const unprovisionedDeviceId = 'FX9600-NO-SECRET-01';
    await withTenantContext(schoolId, async (tx) => {
      await tx.insert(rfidReaders).values({
        schoolId,
        deviceId: unprovisionedDeviceId,
        name: 'Unprovisioned Gate',
        adapterType: 'NETWORK',
        securityCapability: 'ZEBRA_FX9600',
        status: 'ACTIVE',
        sharedSecretEncrypted: null,
        bearerTokenDigest: null,
      });
    });

    const payload = {
      type: 'tag_read',
      reader_name: unprovisionedDeviceId,
      data: [{ idHex: testEpc }],
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacSecret).update(rawBody, 'utf8').digest('hex');

    const res = await dispatchRfidRoute(schoolId, {
      headers: {
        'Content-Type': 'application/json',
        'x-reader-id': unprovisionedDeviceId,
        'x-zebra-signature': signature,
      },
      body: payload,
      rawBody: Buffer.from(rawBody),
    });

    // Must fail closed with 500 CONFIG_ERROR or 401 UNAUTHORIZED_READER
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toMatch(/CONFIG_ERROR|UNAUTHORIZED_READER/);
  });

  it('Manual Attendance Protection: Manually marked ABSENT record is never overwritten to PRESENT by gate scan', async () => {
    const manualStudentCode = 'ZG-MANUAL-STD-01';
    const manualEpc = 'E28011700000020B85799999';
    const manualDigest = computeEpcDigest(manualEpc);

    // Create student & enrollment
    const [manualStudent] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .insert(students)
        .values({
          schoolId,
          name: 'Manual Test Student',
          studentCode: manualStudentCode,
          status: 'ACTIVE',
        })
        .returning();
    });

    await withTenantContext(schoolId, async (tx) => {
      await tx.insert(enrollments).values({
        schoolId,
        studentId: manualStudent.id,
        classSectionId: testClassSectionId,
        academicYearId: testAcademicYearId,
        rollNumber: 301,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });
    });

    // Enroll credential
    const cred = await credentialService.enrollCredential({
      schoolId,
      studentId: manualStudent.id,
      credentialDigest: manualDigest,
      securityMode: 'UHF_EPC',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId, adminUserId);

    // Resolve today's date in school timezone
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // Create or find open attendance session
    let [session] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.schoolId, schoolId),
            eq(attendanceSessions.classSectionId, testClassSectionId),
            eq(attendanceSessions.sessionDate, todayDate)
          )
        );
    });

    if (!session) {
      [session] = await withTenantContext(schoolId, async (tx) => {
        return tx
          .insert(attendanceSessions)
          .values({
            schoolId,
            classSectionId: testClassSectionId,
            teacherId: teacherUserId,
            sessionDate: todayDate,
            status: 'OPEN',
            startedAt: new Date(),
            sourceMode: 'MANUAL',
          })
          .returning();
      });
    }

    // Teacher manually marks student as ABSENT
    await withTenantContext(schoolId, async (tx) => {
      await tx
        .insert(attendanceRecords)
        .values({
          schoolId,
          attendanceSessionId: session.id,
          studentId: manualStudent.id,
          status: 'ABSENT',
          captureMethod: 'MANUAL',
          lastUpdatedAt: new Date(),
        })
        .onConflictDoNothing();
    });

    // An RFID Gate scan arrives for this student
    const payload = {
      type: 'tag_read',
      reader_name: testReaderDeviceId,
      data: [
        {
          idHex: manualEpc,
          antenna: 1,
          peakRssi: -50,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacSecret).update(rawBody, 'utf8').digest('hex');

    const res = await dispatchRfidRoute(schoolId, {
      headers: {
        'Content-Type': 'application/json',
        'x-reader-id': testReaderDeviceId,
        'x-zebra-signature': signature,
      },
      body: payload,
      rawBody: Buffer.from(rawBody),
    });

    expect(res.status).toBe(200);

    // Verify the record REMAINS ABSENT and was NOT overwritten by RFID_GATE
    const [finalRecord] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.attendanceSessionId, session.id),
            eq(attendanceRecords.studentId, manualStudent.id)
          )
        );
    });

    expect(finalRecord.status).toBe('ABSENT');
    expect(finalRecord.captureMethod).toBe('MANUAL');
  });
});
