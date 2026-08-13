import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';

export interface OutboxItem {
  id: string;
  envelope: any;
  retryCount: number;
  enqueuedAt: string;
  nextAttemptAt?: string;
  status: 'PENDING' | 'RESERVED' | 'DEAD_LETTER';
}

export interface OutboxQueueConfig {
  storageDir?: string;
  deviceEncryptionKey?: string;
  maxCapacity?: number;
  maxRetries?: number;
}

export class OutboxQueue {
  private queueFilePath: string;
  private storageDir: string;
  private secretKey: Buffer;
  private maxCapacity: number;
  private maxRetries: number;
  private isQuarantined: boolean = false;

  constructor(config?: OutboxQueueConfig) {
    this.storageDir = config?.storageDir || path.join(process.cwd(), '.gateway-storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    this.queueFilePath = path.join(this.storageDir, 'outbox-queue.json.enc');

    const keyStr = config?.deviceEncryptionKey || process.env.RFID_OUTBOX_ENCRYPTION_KEY || process.env.RFID_HMAC_SECRET;
    if (process.env.NODE_ENV === 'production' && (!keyStr || keyStr.length < 32)) {
      throw new Error('OUTBOX_FATAL: RFID_OUTBOX_ENCRYPTION_KEY must be at least 32 bytes in production mode');
    }

    const effectiveSecret = keyStr || 'test-outbox-device-key-32-chars-long-env';
    this.secretKey = Buffer.from(crypto.hkdfSync('sha256', effectiveSecret, 'outbox-salt', 'device-outbox-key', 32));
    this.maxCapacity = config?.maxCapacity || parseInt(process.env.RFID_OFFLINE_QUEUE_CAPACITY || '10000', 10);
    this.maxRetries = config?.maxRetries || 5;
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(encryptedStr: string): string {
    if (!encryptedStr || typeof encryptedStr !== 'string') {
      throw new Error('OUTBOX_CORRUPTED: Empty or invalid payload');
    }
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('OUTBOX_CORRUPTED: Invalid format structure');
    }
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipherText = Buffer.from(cipherHex, 'hex');

    if (iv.length !== 12 || tag.length !== 16) {
      throw new Error('OUTBOX_CORRUPTED: Invalid IV or Auth Tag length');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.secretKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
  }

  private quarantineStore(reason: string): never {
    this.isQuarantined = true;
    const quarantineDir = path.join(this.storageDir, '.quarantine');
    if (!fs.existsSync(quarantineDir)) {
      fs.mkdirSync(quarantineDir, { recursive: true });
    }
    if (fs.existsSync(this.queueFilePath)) {
      const targetPath = path.join(quarantineDir, `outbox-corrupted-${Date.now()}.enc`);
      try {
        fs.renameSync(this.queueFilePath, targetPath);
      } catch {
        // Ignore rename error
      }
    }
    throw new Error(`OUTBOX_CORRUPTED: Outbox queue file is corrupted or tampered. Preserved for forensic audit. ${reason}`);
  }

  private loadQueue(): OutboxItem[] {
    if (this.isQuarantined) {
      throw new Error('OUTBOX_QUARANTINED: Outbox queue is quarantined due to prior corruption failure');
    }
    if (!fs.existsSync(this.queueFilePath)) {
      return [];
    }
    try {
      const rawEncrypted = fs.readFileSync(this.queueFilePath, 'utf8');
      if (!rawEncrypted) return [];
      const jsonStr = this.decrypt(rawEncrypted);
      const items = JSON.parse(jsonStr);
      if (!Array.isArray(items)) {
        this.quarantineStore('JSON payload is not an array');
      }
      return items;
    } catch (err: any) {
      if (err.message?.startsWith('OUTBOX_QUARANTINED')) {
        throw err;
      }
      this.quarantineStore(err.message);
    }
  }

  private saveQueue(items: OutboxItem[]): void {
    const jsonStr = JSON.stringify(items);
    const encrypted = this.encrypt(jsonStr);
    const tmpPath = `${this.queueFilePath}.tmp`;
    fs.writeFileSync(tmpPath, encrypted, 'utf8');
    fs.renameSync(tmpPath, this.queueFilePath);
  }

  enqueue(envelope: any): OutboxItem {
    const queue = this.loadQueue();
    if (queue.length >= this.maxCapacity) {
      throw new Error(`OUTBOX_CAPACITY_EXCEEDED: Queue length ${queue.length} reached capacity limit ${this.maxCapacity}`);
    }

    const item: OutboxItem = {
      id: envelope.clientEventId || `outbox_${crypto.randomUUID()}`,
      envelope,
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      status: 'PENDING',
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  peekBatch(batchSize: number = 50): OutboxItem[] {
    const queue = this.loadQueue();
    const now = new Date().getTime();
    return queue
      .filter((item) => item.status === 'PENDING' && (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now))
      .slice(0, batchSize);
  }

  reserveBatch(batchSize: number = 50): OutboxItem[] {
    const queue = this.loadQueue();
    const now = new Date().getTime();
    const reserved: OutboxItem[] = [];

    const updated = queue.map((item) => {
      if (reserved.length < batchSize && item.status === 'PENDING' && (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now)) {
        const itemReserved: OutboxItem = { ...item, status: 'RESERVED' };
        reserved.push(itemReserved);
        return itemReserved;
      }
      return item;
    });

    if (reserved.length > 0) {
      this.saveQueue(updated);
    }
    return reserved;
  }

  purgeBatch(idsToPurge: string[]): void {
    const set = new Set(idsToPurge);
    const queue = this.loadQueue().filter((item) => !set.has(item.id));
    this.saveQueue(queue);
  }

  recordFailure(idsToFail: string[]): void {
    const set = new Set(idsToFail);
    const queue = this.loadQueue().map((item) => {
      if (set.has(item.id)) {
        const newRetry = item.retryCount + 1;
        const isDead = newRetry >= this.maxRetries;
        const jitterMs = Math.floor(Math.random() * 500);
        const backoffMs = Math.pow(2, newRetry) * 1000 + jitterMs;
        const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();

        return {
          ...item,
          retryCount: newRetry,
          nextAttemptAt,
          status: (isDead ? 'DEAD_LETTER' : 'PENDING') as 'PENDING' | 'RESERVED' | 'DEAD_LETTER',
        };
      }
      return item;
    });
    this.saveQueue(queue);
  }

  getDeadLetterItems(): OutboxItem[] {
    return this.loadQueue().filter((item) => item.status === 'DEAD_LETTER');
  }

  size(): number {
    return this.loadQueue().length;
  }

  clear(): void {
    this.isQuarantined = false;
    if (fs.existsSync(this.queueFilePath)) {
      fs.unlinkSync(this.queueFilePath);
    }
  }
}
