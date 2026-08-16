import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { db, withTenantContext } from '../../src/db';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
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
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  extractZebraTagReads,
  processZebraIotWebhook,
} from '../../src/services/rfid/zebraIotConnector';
import {
  canonicalizeEpc,
  computeEpcDigest,
  getEpcLastFour,
} from '../../src/services/rfid/cryptoService';
import fixtureData from '../fixtures/zebra-iot-connector.json';

describe('Zebra FX9600 IoT Connector Service', () => {
  let schoolId: string;
  let adminUserId: string;
  const testReaderDeviceId = 'FX9600-GATE-01';
  let testReaderId: string;
  let testStudentId: string;
  let testClassSectionId: string;
  let testAcademicYearId: string;
  const testEpc = 'E28011700000020B85794820';
  const testEpcDigest = computeEpcDigest(testEpc);
  const hmacSecret = 'test-secret-32-chars-length-environment';

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = hmacSecret;
    process.env.SMS_PROVIDER = 'console';
    process.env.NODE_ENV = 'test';

    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;

    // Get current Academic Year
    const [ay] = await withTenantContext(schoolId, async (tx) => {
      return tx.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))).limit(1);
    });
    testAcademicYearId = ay.id;

    // Get or create class section
    const [sec] = await withTenantContext(schoolId, async (tx) => {
      return tx.select().from(classSections).where(eq(classSections.schoolId, schoolId)).limit(1);
    });
    testClassSectionId = sec.id;

    // Create test student
    const [st] = await withTenantContext(schoolId, async (tx) => {
      return tx
        .insert(students)
        .values({
          schoolId,
          name: 'Ananya Banerjee',
          studentCode: 'ZG-STD-001',
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
        rollNumber: 101,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });
    });

    // Register & approve FX9600 reader
    const reader = await readerService.registerReader({
      schoolId,
      deviceId: testReaderDeviceId,
      name: 'North Gate Turnstile 1',
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
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId, adminUserId);
  });

  describe('extractZebraTagReads Normalization', () => {
    it('normalizes standard Zebra IoT Connector payload with data array', () => {
      const { reads, readerIdentifier, eventType } = extractZebraTagReads(fixtureData.standardPayload);
      expect(reads).toHaveLength(2);
      expect(reads[0].idHex).toBe('E28011700000020B85794820');
      expect(reads[0].antenna).toBe(1);
      expect(readerIdentifier).toBe('FX9600-GATE-01');
      expect(eventType).toBe('tag_read');
    });

    it('normalizes root array payload', () => {
      const { reads } = extractZebraTagReads(fixtureData.arrayPayload);
      expect(reads).toHaveLength(1);
      expect(reads[0].epc).toBe('E28011700000020B85794820');
    });

    it('normalizes single tag object payload', () => {
      const { reads } = extractZebraTagReads(fixtureData.singleTagPayload);
      expect(reads).toHaveLength(1);
      expect(reads[0].epc).toBe('E28011700000020B85794820');
    });

    it('normalizes heartbeat event payload', () => {
      const { reads, eventType, readerIdentifier } = extractZebraTagReads(fixtureData.heartbeatPayload);
      expect(reads).toHaveLength(0);
      expect(eventType).toBe('heartbeat');
      expect(readerIdentifier).toBe('FX9600-GATE-01');
    });
  });

  describe('processZebraIotWebhook Ingest Flow', () => {
    it('successfully processes valid EPC tag read and marks student PRESENT', async () => {
      const payload = {
        type: 'tag_read',
        reader_name: testReaderDeviceId,
        data: [
          {
            idHex: testEpc,
            antenna: 1,
            peakRssi: -58,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const res = await processZebraIotWebhook({
        schoolId,
        rawBody,
        parsedBody: payload,
        headers: {
          'x-reader-id': testReaderDeviceId,
        },
      });

      expect(res.success).toBe(true);
      expect(res.acceptedCount).toBe(1);
      expect(res.duplicateCount).toBe(0);
      expect(res.rejectedCount).toBe(0);
      expect(res.results[0].decision).toBe('ACCEPTED');
      expect(res.results[0].studentId).toBe(testStudentId);
      expect(res.results[0].epcLastFour).toBe('4820');

      // Verify attendance record created in database
      const [record] = await withTenantContext(schoolId, async (tx) => {
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

      expect(record).toBeDefined();
      expect(record.status).toBe('PRESENT');
      expect(record.captureMethod).toBe('RFID');

      // Verify scan event does NOT contain raw EPC
      const [scanEvent] = await withTenantContext(schoolId, async (tx) => {
        return tx
          .select()
          .from(rfidScanEvents)
          .where(
            and(
              eq(rfidScanEvents.schoolId, schoolId),
              eq(rfidScanEvents.readerId, testReaderId)
            )
          );
      });

      expect(scanEvent).toBeDefined();
      expect(scanEvent.decision).toBe('ACCEPTED');
      // Ensure zero occurrence of raw EPC string in scanEvent columns
      expect(JSON.stringify(scanEvent)).not.toContain(testEpc);
    });

    it('debounces duplicate tag reads within cooldown interval', async () => {
      // Create distinct student for debounce test
      const debounceEpc = 'E28011700000020B85799999';
      const debounceDigest = computeEpcDigest(debounceEpc);
      let debStudentId: string;

      await withTenantContext(schoolId, async (tx) => {
        const [st] = await tx
          .insert(students)
          .values({
            schoolId,
            name: 'Debounce Student',
            studentCode: 'ZG-STD-DEB',
            status: 'ACTIVE',
          })
          .returning();
        debStudentId = st.id;

        await tx.insert(enrollments).values({
          schoolId,
          studentId: debStudentId,
          classSectionId: testClassSectionId,
          academicYearId: testAcademicYearId,
          rollNumber: 102,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        });

        await tx.insert(rfidCredentials).values({
          schoolId,
          studentId: debStudentId,
          credentialDigest: debounceDigest,
          securityMode: 'SECURE',
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
            idHex: debounceEpc,
            antenna: 1,
            peakRssi: -60,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const rawBody = JSON.stringify(payload);

      // First Walk
      const res1 = await processZebraIotWebhook({
        schoolId,
        rawBody,
        parsedBody: payload,
        headers: { 'x-reader-id': testReaderDeviceId },
      });
      expect(res1.acceptedCount).toBe(1);

      // Second Walk immediately (within cooldown)
      const res2 = await processZebraIotWebhook({
        schoolId,
        rawBody,
        parsedBody: payload,
        headers: { 'x-reader-id': testReaderDeviceId },
      });

      expect(res2.duplicateCount).toBe(1);
      expect(res2.acceptedCount).toBe(0);
      expect(res2.results[0].decision).toBe('DUPLICATE');
      expect(res2.results[0].duplicate).toBe(true);
    });

    it('rejects unknown unregistered EPC tag', async () => {
      const unknownEpc = '3034257BF400B7800004CB09';
      const payload = {
        type: 'tag_read',
        reader_name: testReaderDeviceId,
        data: [
          {
            idHex: unknownEpc,
            antenna: 2,
            peakRssi: -65,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const res = await processZebraIotWebhook({
        schoolId,
        rawBody,
        parsedBody: payload,
        headers: { 'x-reader-id': testReaderDeviceId },
      });

      expect(res.rejectedCount).toBe(1);
      expect(res.results[0].decision).toBe('UNKNOWN_CARD');
      expect(res.results[0].reason).toBe('UNREGISTERED_EPC_BADGE');
    });

    it('rejects revoked credential', async () => {
      const revokedEpc = 'E28011700000020B85797777';
      const revokedDigest = computeEpcDigest(revokedEpc);

      await withTenantContext(schoolId, async (tx) => {
        const [st] = await tx
          .insert(students)
          .values({
            schoolId,
            name: 'Revoked Student',
            studentCode: 'ZG-STD-REV',
            status: 'ACTIVE',
          })
          .returning();

        await tx.insert(enrollments).values({
          schoolId,
          studentId: st.id,
          classSectionId: testClassSectionId,
          academicYearId: testAcademicYearId,
          rollNumber: 103,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        });

        await tx.insert(rfidCredentials).values({
          schoolId,
          studentId: st.id,
          credentialDigest: revokedDigest,
          securityMode: 'SECURE',
          keyVersion: 1,
          status: 'REVOKED',
          createdByUserId: adminUserId,
        });
      });

      const payload = {
        type: 'tag_read',
        reader_name: testReaderDeviceId,
        data: [
          {
            idHex: revokedEpc,
            antenna: 1,
            peakRssi: -58,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const res = await processZebraIotWebhook({
        schoolId,
        rawBody,
        parsedBody: payload,
        headers: { 'x-reader-id': testReaderDeviceId },
      });

      expect(res.rejectedCount).toBe(1);
      expect(res.results[0].decision).toBe('REVOKED_CARD');
    });

    it('rejects unauthorized or unknown reader ID', async () => {
      const payload = {
        type: 'tag_read',
        reader_name: 'UNKNOWN-READER-999',
        data: [{ idHex: testEpc }],
      };

      await expect(
        processZebraIotWebhook({
          schoolId,
          rawBody: JSON.stringify(payload),
          parsedBody: payload,
          headers: { 'x-reader-id': 'UNKNOWN-READER-999' },
        })
      ).rejects.toThrow('UNAUTHORIZED_READER');
    });

    it('handles heartbeat keepalive payloads cleanly', async () => {
      const payload = {
        type: 'heartbeat',
        reader_name: testReaderDeviceId,
        status: 'OPERATIONAL',
      };

      const res = await processZebraIotWebhook({
        schoolId,
        rawBody: JSON.stringify(payload),
        parsedBody: payload,
        headers: { 'x-reader-id': testReaderDeviceId },
      });

      expect(res.success).toBe(true);
      expect(res.processedCount).toBe(0);

      // Verify reader lastSeenAt updated
      const [rdr] = await withTenantContext(schoolId, async (tx) => {
        return tx.select().from(rfidReaders).where(eq(rfidReaders.id, testReaderId));
      });
      expect(rdr.lastSeenAt).toBeDefined();
    });
  });

  describe('Route Dispatch & FEATURE_RFID Mount Isolation', () => {
    it('POST /:schoolId/rfid/zebra/reads endpoint processes webhook successfully', async () => {
      const { rfidRouter } = await import('../../src/routes/rfidRoutes');
      const payload = {
        type: 'tag_read',
        reader_name: testReaderDeviceId,
        data: [{ idHex: testEpc, antenna: 1, peakRssi: -55, timestamp: new Date().toISOString() }],
      };
      const rawBodyBuf = Buffer.from(JSON.stringify(payload));
      const headersMap: Record<string, string> = {
        'x-reader-id': testReaderDeviceId,
        'content-type': 'application/json',
      };

      const res = await new Promise<{ statusCode: number; body: any }>((resolve) => {
        const req: any = {
          method: 'POST',
          url: `/${schoolId}/rfid/zebra/reads`,
          originalUrl: `/${schoolId}/rfid/zebra/reads`,
          params: { schoolId },
          headers: headersMap,
          get: (name: string) => headersMap[name.toLowerCase()],
          header: (name: string) => headersMap[name.toLowerCase()],
          body: payload,
          rawBody: rawBodyBuf,
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        };

        const mockRes: any = {
          statusCode: 200,
          setHeader() {},
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            this.body = data;
            resolve({ statusCode: this.statusCode, body: this.body });
            return this;
          },
        };

        (rfidRouter as any).handle(req, mockRes, (err: any) => {
          if (err) resolve({ statusCode: 500, body: { error: err.message } });
          else resolve({ statusCode: 404, body: { error: 'NOT_FOUND' } });
        });
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('FEATURE_RFID=false omits rfidRouter from mounted routes in server', async () => {
      const origEnv = process.env.FEATURE_RFID;
      try {
        process.env.FEATURE_RFID = 'false';
        const { createApp } = await import('../../server');
        const app = await createApp();

        const headersMap: Record<string, string> = {
          'content-type': 'application/json',
          'x-reader-id': testReaderDeviceId,
        };

        // Dispatch request against app stack
        const res = await new Promise<{ statusCode: number; body: any }>((resolve) => {
          const req: any = {
            method: 'POST',
            url: `/api/v1/schools/${schoolId}/rfid/zebra/reads`,
            originalUrl: `/api/v1/schools/${schoolId}/rfid/zebra/reads`,
            headers: headersMap,
            get: (name: string) => headersMap[name.toLowerCase()],
            header: (name: string) => headersMap[name.toLowerCase()],
            body: { type: 'tag_read' },
            cookies: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            app,
          };

          const mockRes: any = {
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
              resolve({ statusCode: this.statusCode, body: this.body });
              return this;
            },
            send(data: any) {
              this.body = data;
              resolve({ statusCode: this.statusCode, body: this.body });
              return this;
            },
          };

          (app as any).handle(req, mockRes, () => {
            resolve({ statusCode: 404, body: { error: 'API_ENDPOINT_NOT_FOUND' } });
          });
        });

        expect(res.statusCode).toBe(404);
      } finally {
        process.env.FEATURE_RFID = origEnv;
      }
    });
  });
});


