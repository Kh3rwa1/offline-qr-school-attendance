import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';

export interface OutboxItem {
  id: string;
  envelope: any;
  retryCount: number;
  enqueuedAt: string;
}

export class OutboxQueue {
  private queueFilePath: string;
  private secretKey: Buffer;

  constructor(storageDir?: string, secret?: string) {
    const dir = storageDir || path.join(process.cwd(), '.gateway-storage');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.queueFilePath = path.join(dir, 'outbox-queue.json.enc');

    const keyStr = secret || process.env.RFID_HMAC_SECRET || 'outbox-storage-secret-32-bytes';
    this.secretKey = crypto.createHash('sha256').update(keyStr).digest();
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(encryptedStr: string): string {
    const [ivHex, tagHex, cipherHex] = encryptedStr.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipherText = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.secretKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
  }

  private loadQueue(): OutboxItem[] {
    if (!fs.existsSync(this.queueFilePath)) {
      return [];
    }
    try {
      const rawEncrypted = fs.readFileSync(this.queueFilePath, 'utf8');
      if (!rawEncrypted) return [];
      const jsonStr = this.decrypt(rawEncrypted);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn('OutboxQueue read warning, initializing fresh queue:', err);
      return [];
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
    const item: OutboxItem = {
      id: envelope.clientEventId || `outbox_${Date.now()}_${Math.random()}`,
      envelope,
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  peekBatch(batchSize: number = 50): OutboxItem[] {
    const queue = this.loadQueue();
    return queue.slice(0, batchSize);
  }

  purgeBatch(idsToPurge: string[]): void {
    const set = new Set(idsToPurge);
    const queue = this.loadQueue().filter((item) => !set.has(item.id));
    this.saveQueue(queue);
  }

  incrementRetryCount(idsToIncrement: string[]): void {
    const set = new Set(idsToIncrement);
    const queue = this.loadQueue().map((item) => {
      if (set.has(item.id)) {
        return { ...item, retryCount: item.retryCount + 1 };
      }
      return item;
    });
    this.saveQueue(queue);
  }

  size(): number {
    return this.loadQueue().length;
  }

  clear(): void {
    if (fs.existsSync(this.queueFilePath)) {
      fs.unlinkSync(this.queueFilePath);
    }
  }
}
