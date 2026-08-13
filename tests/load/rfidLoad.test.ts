import { describe, it, expect, beforeAll } from 'vitest';
import { scanService } from '../../src/services/rfid/scanService';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import crypto from 'crypto';

function signEnvelope(envelopeData: Record<string, any>, secret: string): string {
  const payload = JSON.stringify(envelopeData, Object.keys(envelopeData).sort());
  return crypto.createHmac('sha256', secret).update(String(payload)).digest('hex');
}

describe('RFID Load & Endurance Certification Suite', () => {
  let schoolId: string;
  let readerId: string;

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = 'load-test-secret-32-chars-long-env';
    await runMigrations();
    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;

    const reader = await readerService.registerReader({
      schoolId,
      deviceId: 'dev_load_1',
      name: 'Main Gate Load Test Reader',
      adapterType: 'GATEWAY',
    });
    const approved = await readerService.approveReader(reader.id, schoolId);
    readerId = approved.id;
  });

  it('Morning burst scenario: processes 100 sequential scan iterations with latency metrics', async () => {
    const latencies: number[] = [];
    const decisions: Record<string, number> = {};
    const secret = process.env.RFID_HMAC_SECRET!;

    for (let i = 0; i < 100; i++) {
      const baseEnvelope = {
        version: 1,
        schoolId,
        readerId,
        readerTimestamp: new Date().toISOString(),
        nonce: `nonce_load_${i}_${Date.now()}`,
        securityMode: 'SECURE' as const,
        clientEventId: `evt_load_${i}_${Date.now()}`,
        credentialDigest: `digest_load_${i}`,
      };
      const signature = signEnvelope(baseEnvelope, secret);
      const envelope = { ...baseEnvelope, signature };

      try {
        const res = await scanService.processScan(envelope);
        latencies.push(res.processingLatencyMs);
        decisions[res.decision] = (decisions[res.decision] || 0) + 1;
      } catch (err) {
        // scan processing returns structured decisions
      }
    }

    expect(latencies.length).toBe(100);
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p50).toBeLessThan(100); // 100ms threshold
    expect(p95).toBeLessThan(250); // 250ms threshold
  });

  it('Unknown card surge: handles 50 rapid unknown card taps gracefully', async () => {
    let unknownCardCount = 0;
    const secret = process.env.RFID_HMAC_SECRET!;

    for (let i = 0; i < 50; i++) {
      const baseEnvelope = {
        version: 1,
        schoolId,
        readerId,
        readerTimestamp: new Date().toISOString(),
        nonce: `nonce_unknown_${i}_${Date.now()}`,
        securityMode: 'SECURE' as const,
        clientEventId: `evt_unknown_${i}_${Date.now()}`,
        credentialDigest: `unknown_digest_${i}`,
      };
      const signature = signEnvelope(baseEnvelope, secret);
      const envelope = { ...baseEnvelope, signature };

      const res = await scanService.processScan(envelope);
      if (res.decision === 'UNKNOWN_CARD') {
        unknownCardCount++;
      }
    }

    expect(unknownCardCount).toBe(50);
  });
});
