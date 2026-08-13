import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutboxQueue } from '../../src/gateway/outboxQueue';
import fs from 'node:fs';
import path from 'node:path';

describe('Durable Encrypted Outbox Queue Suite', () => {
  const testDir = path.join(process.cwd(), 'scratch', 'test-outbox-storage');
  const secret = 'outbox-test-secret-32-chars-long';
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.NODE_ENV;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('Enqueues, encrypts, and peeks items from durable outbox storage', () => {
    const queue = new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: secret });
    expect(queue.size()).toBe(0);

    queue.enqueue({ clientEventId: 'evt_001', credentialDigest: 'digest_1' });
    queue.enqueue({ clientEventId: 'evt_002', credentialDigest: 'digest_2' });

    expect(queue.size()).toBe(2);

    const items = queue.peekBatch(10);
    expect(items).toHaveLength(2);
    expect(items[0].envelope.clientEventId).toBe('evt_001');
    expect(items[1].envelope.clientEventId).toBe('evt_002');
  });

  it('Rejects short encryption key in production mode', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: 'short-key' })).toThrow('OUTBOX_FATAL');
  });

  it('Enforces capacity limit and fails closed when full', () => {
    const queue = new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: secret, maxCapacity: 2 });
    queue.enqueue({ clientEventId: 'evt_1' });
    queue.enqueue({ clientEventId: 'evt_2' });

    expect(() => queue.enqueue({ clientEventId: 'evt_3' })).toThrow('OUTBOX_CAPACITY_EXCEEDED');
  });

  it('Quarantines file and fails closed on data corruption without returning empty queue', () => {
    const queue = new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: secret });
    queue.enqueue({ clientEventId: 'evt_corrupt_test' });

    const queueFilePath = path.join(testDir, 'outbox-queue.json.enc');
    fs.writeFileSync(queueFilePath, 'corrupted_tag:garbage_cipher_text:invalid', 'utf8');

    const corruptedQueue = new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: secret });
    expect(() => corruptedQueue.size()).toThrow('OUTBOX_CORRUPTED');

    const quarantineDir = path.join(testDir, '.quarantine');
    expect(fs.existsSync(quarantineDir)).toBe(true);
    const files = fs.readdirSync(quarantineDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('Applies exponential backoff and moves items to dead-letter queue on max retries', () => {
    const queue = new OutboxQueue({ storageDir: testDir, deviceEncryptionKey: secret, maxRetries: 2 });
    queue.enqueue({ clientEventId: 'evt_retry_test' });

    queue.recordFailure(['evt_retry_test']);
    let items = queue.peekBatch(10);
    // Because nextAttemptAt has exponential backoff delay, peekBatch filters it out
    expect(items).toHaveLength(0);

    queue.recordFailure(['evt_retry_test']);
    const deadLetters = queue.getDeadLetterItems();
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0].status).toBe('DEAD_LETTER');
  });
});
