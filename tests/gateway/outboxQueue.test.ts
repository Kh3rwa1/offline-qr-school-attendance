import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutboxQueue } from '../../src/gateway/outboxQueue';
import fs from 'node:fs';
import path from 'node:path';

describe('Durable Encrypted Outbox Queue Suite', () => {
  const testDir = path.join(process.cwd(), 'scratch', 'test-outbox-storage');
  const secret = 'outbox-test-secret-32-chars-long';

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('Enqueues, encrypts, and peeks items from durable outbox storage', () => {
    const queue = new OutboxQueue(testDir, secret);
    expect(queue.size()).toBe(0);

    queue.enqueue({ clientEventId: 'evt_001', credentialDigest: 'digest_1' });
    queue.enqueue({ clientEventId: 'evt_002', credentialDigest: 'digest_2' });

    expect(queue.size()).toBe(2);

    const items = queue.peekBatch(10);
    expect(items).toHaveLength(2);
    expect(items[0].envelope.clientEventId).toBe('evt_001');
    expect(items[1].envelope.clientEventId).toBe('evt_002');
  });

  it('Persists data across process restarts (crash safety)', () => {
    const queue1 = new OutboxQueue(testDir, secret);
    queue1.enqueue({ clientEventId: 'evt_crash_01', credentialDigest: 'digest_crash' });

    // Simulate process crash & restart by reinstantiating queue object reading same file
    const queue2 = new OutboxQueue(testDir, secret);
    expect(queue2.size()).toBe(1);
    const items = queue2.peekBatch(10);
    expect(items[0].envelope.clientEventId).toBe('evt_crash_01');
  });

  it('Purges processed items and increments retry count for failed items', () => {
    const queue = new OutboxQueue(testDir, secret);
    queue.enqueue({ clientEventId: 'evt_success', credentialDigest: 'digest_a' });
    queue.enqueue({ clientEventId: 'evt_fail', credentialDigest: 'digest_b' });

    queue.purgeBatch(['evt_success']);
    expect(queue.size()).toBe(1);

    queue.incrementRetryCount(['evt_fail']);
    const items = queue.peekBatch(10);
    expect(items[0].id).toBe('evt_fail');
    expect(items[0].retryCount).toBe(1);
  });
});
