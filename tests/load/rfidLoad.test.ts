import { describe, it, expect, beforeAll } from 'vitest';
import { scanService } from '../../src/services/rfid/scanService';
import { offlineService } from '../../src/services/rfid/offlineService';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';
import { db } from '../../src/db';
import { students } from '../../src/db/schema';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

describe('RFID Multi-Tenant Load & Endurance Certification Suite', () => {
  let schoolAId: string;
  let schoolBId: string;
  let readerAId: string;
  let readerBId: string;
  let credentialDigestA: string;
  let studentAId: string;
  const secret = 'load-test-secret-32-chars-long-env';

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = secret;
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolAId = seeded.schoolA.id;
    schoolBId = seeded.schoolB.id;

    // Register reader for School A
    const readerA = await readerService.registerReader({
      schoolId: schoolAId,
      deviceId: 'dev_load_school_a',
      name: 'School A Main Gate',
      adapterType: 'GATEWAY',
    });
    const appA = await readerService.approveReader(readerA.id, schoolAId);
    readerAId = appA.id;

    // Register reader for School B
    const readerB = await readerService.registerReader({
      schoolId: schoolBId,
      deviceId: 'dev_load_school_b',
      name: 'School B Main Gate',
      adapterType: 'GATEWAY',
    });
    const appB = await readerService.approveReader(readerB.id, schoolBId);
    readerBId = appB.id;

    // Create test student for School A
    const [studentA] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: 'LOAD-STD-A01',
        name: 'Load Test Student A',
        status: 'ACTIVE',
      })
      .returning();
    studentAId = studentA.id;

    const credA = await credentialService.enrollCredential({
      schoolId: schoolAId,
      studentId: studentAId,
      credentialDigest: 'digest_load_student_a',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: seeded.adminUser.id,
    });
    credentialDigestA = credA.credentialDigest;
  });

  function buildEnvelope(schoolId: string, readerId: string, credentialDigest: string, index: number, runPrefix: string = 'r1') {
    const timestamp = new Date().toISOString();
    const nonce = `nonce_load_${schoolId}_${runPrefix}_${index}_${Date.now()}_${Math.random()}`;
    const clientEventId = `evt_load_${schoolId}_${runPrefix}_${index}_${Date.now()}_${Math.random()}`;
    const proofPayload = `secure-proof-v1:${credentialDigest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', secret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId,
      readerId,
      credentialDigest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: index,
      nonce,
      direction: 'NONE',
      securityMode: 'SECURE',
      clientEventId,
      isOffline: false,
    };
    envelope.signature = computeCanonicalSignature(envelope, secret);
    return envelope;
  }

  it('Morning burst scenario: 100 sequential scans with p50 < 100ms, p95 < 250ms', async () => {
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const envelope: any = buildEnvelope(schoolAId, readerAId, `digest_unknown_${i}`, i);
      const res = await scanService.processScan(envelope);
      latencies.push(res.processingLatencyMs);
    }

    expect(latencies.length).toBe(100);
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p50).toBeLessThan(100);
    expect(p95).toBeLessThan(250);
  });

  it('50 parallel concurrent clients tapping simultaneously', async () => {
    const promises = Array.from({ length: 50 }, (_, i) => {
      const envelope: any = buildEnvelope(schoolAId, readerAId, `digest_concurrent_${i}`, i);
      return scanService.processScan(envelope);
    });

    const results = await Promise.all(promises);
    expect(results.length).toBe(50);
    expect(results.every((r) => r.decision !== undefined)).toBe(true);
  });

  it('Multi-school parallel contention (School A and School B concurrent scans)', async () => {
    const promisesSchoolA = Array.from({ length: 25 }, (_, i) => {
      const envelope: any = buildEnvelope(schoolAId, readerAId, `digest_multi_a_${i}`, i);
      return scanService.processScan(envelope);
    });
    const promisesSchoolB = Array.from({ length: 25 }, (_, i) => {
      const envelope: any = buildEnvelope(schoolBId, readerBId, `digest_multi_b_${i}`, i);
      return scanService.processScan(envelope);
    });

    const [resultsA, resultsB] = await Promise.all([
      Promise.all(promisesSchoolA),
      Promise.all(promisesSchoolB),
    ]);

    expect(resultsA.length).toBe(25);
    expect(resultsB.length).toBe(25);
  });

  it('Offline 5,000-event batch sync processing benchmark across 3 measured runs', async () => {
    const runs: { run: number; durationMs: number; rps: number }[] = [];

    // Warm-up run
    const warmupEvents = Array.from({ length: 500 }, (_, i) => buildEnvelope(schoolAId, readerAId, `digest_warm_${i}`, i, 'warm'));
    await offlineService.syncOfflineEvents(schoolAId, warmupEvents as any);

    for (let runIdx = 1; runIdx <= 3; runIdx++) {
      const offlineEvents = Array.from({ length: 5000 }, (_, i) => buildEnvelope(schoolAId, readerAId, `digest_offline_${i}`, i, `run${runIdx}`));
      const startTime = Date.now();
      const results = await offlineService.syncOfflineEvents(schoolAId, offlineEvents as any);
      const elapsed = Date.now() - startTime;

      expect(results.length).toBe(5000);
      expect(elapsed).toBeLessThan(10000);

      runs.push({
        run: runIdx,
        durationMs: elapsed,
        rps: Number((5000 / (elapsed / 1000)).toFixed(2)),
      });
    }

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const reportData = {
      timestamp: new Date().toISOString(),
      eventCount: 5000,
      targetThresholdMs: 10000,
      measuredRuns: runs,
      allRunsPassed: runs.every((r) => r.durationMs < 10000),
    };

    fs.writeFileSync(path.join(outputDir, 'rfid-5k-performance-report.json'), JSON.stringify(reportData, null, 2));
    expect(reportData.allRunsPassed).toBe(true);
  });
});
