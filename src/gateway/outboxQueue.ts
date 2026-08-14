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

/**
 * OutboxQueue — Crash-safe gateway offline storage using SQLite with WAL mode.
 *
 * Replaces the previous encrypted JSON file approach with a proper transactional
 * database providing:
 * - WAL journaling for crash safety and concurrent read/write
 * - Inter-process locking via SQLite's native file locking
 * - fsync guarantees via PRAGMA synchronous=NORMAL
 * - Reservation recovery on startup (stale RESERVED items reset to PENDING)
 * - Per-event AES-256-GCM encryption for payload confidentiality
 * - Quarantine on database corruption with forensic file preservation
 */
export class OutboxQueue {
  private storageDir: string;
  private dbPath: string;
  private secretKey: Buffer;
  private maxCapacity: number;
  private maxRetries: number;
  private isQuarantined: boolean = false;
  private db: any = null;
  private stmtCache: Record<string, any> = {};

  constructor(config?: OutboxQueueConfig) {
    this.storageDir = config?.storageDir || path.join(process.cwd(), '.gateway-storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    this.dbPath = path.join(this.storageDir, 'outbox-queue.sqlite');

    const keyStr = config?.deviceEncryptionKey || process.env.RFID_OUTBOX_ENCRYPTION_KEY || process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-outbox-device-key-32-chars-long-env' : undefined);
    if (!keyStr) {
      throw new Error('OUTBOX_FATAL: Required outbox device encryption key is missing in server configuration');
    }
    if (process.env.NODE_ENV === 'production' && keyStr.length < 32) {
      throw new Error('OUTBOX_FATAL: RFID_OUTBOX_ENCRYPTION_KEY must be at least 32 bytes in production mode');
    }

    this.secretKey = Buffer.from(crypto.hkdfSync('sha256', keyStr, 'outbox-salt', 'device-outbox-key', 32));
    this.maxCapacity = config?.maxCapacity || parseInt(process.env.RFID_OFFLINE_QUEUE_CAPACITY || '10000', 10);
    this.maxRetries = config?.maxRetries || 5;

    this.initDatabase();
    this.migrateFromJsonIfNeeded();
    this.recoverStaleReservations();
  }

  private getBetterSqlite3(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('better-sqlite3');
    } catch {
      return null;
    }
  }

  private initDatabase(): void {
    const Database = this.getBetterSqlite3();
    if (!Database) {
      throw new Error(
        'OUTBOX_FATAL: better-sqlite3 is not installed. ' +
        'Install it with: npm install better-sqlite3'
      );
    }

    try {
      this.db = new Database(this.dbPath);
    } catch (err: any) {
      // Database file is corrupted — quarantine and create fresh
      this.quarantineFile(this.dbPath, `SQLite open failed: ${err.message}`);
      this.db = new Database(this.dbPath);
    }

    // Enable WAL mode for crash safety and concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY NOT NULL,
        payload_encrypted TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RESERVED', 'DEAD_LETTER')),
        retry_count INTEGER DEFAULT 0,
        next_attempt_at INTEGER,
        enqueued_at TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
      CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt ON outbox_events(status, next_attempt_at);

      CREATE TABLE IF NOT EXISTS gateway_counters (
        counter_name TEXT PRIMARY KEY NOT NULL,
        counter_value INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Prepare statements for performance
    this.stmtCache.insert = this.db.prepare(
      `INSERT OR IGNORE INTO outbox_events (id, payload_encrypted, status, retry_count, enqueued_at)
       VALUES (?, ?, 'PENDING', 0, ?)`
    );
    this.stmtCache.count = this.db.prepare('SELECT COUNT(*) as cnt FROM outbox_events');
    this.stmtCache.selectPending = this.db.prepare(
      `SELECT id, payload_encrypted, retry_count, enqueued_at, next_attempt_at, status
       FROM outbox_events
       WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= unixepoch())
       ORDER BY enqueued_at ASC
       LIMIT ?`
    );
    this.stmtCache.reserve = this.db.prepare(
      `UPDATE outbox_events SET status = 'RESERVED', updated_at = unixepoch() WHERE id = ?`
    );
    this.stmtCache.purge = this.db.prepare('DELETE FROM outbox_events WHERE id = ?');
    this.stmtCache.fail = this.db.prepare(
      `UPDATE outbox_events
       SET retry_count = ?, status = ?, next_attempt_at = ?, updated_at = unixepoch()
       WHERE id = ?`
    );
    this.stmtCache.selectDeadLetter = this.db.prepare(
      `SELECT id, payload_encrypted, retry_count, enqueued_at, next_attempt_at, status
       FROM outbox_events WHERE status = 'DEAD_LETTER'`
    );
    this.stmtCache.selectAll = this.db.prepare(
      `SELECT id, payload_encrypted, retry_count, enqueued_at, next_attempt_at, status
       FROM outbox_events`
    );
    this.stmtCache.deleteAll = this.db.prepare('DELETE FROM outbox_events');
    this.stmtCache.recoverStale = this.db.prepare(
      `UPDATE outbox_events
       SET status = 'PENDING', updated_at = unixepoch()
       WHERE status = 'RESERVED' AND updated_at < unixepoch() - 300`
    );
  }

  private quarantineReason: string = '';

  private quarantineFile(filePath: string, reason: string): void {
    this.isQuarantined = true;
    this.quarantineReason = reason;
    const quarantineDir = path.join(this.storageDir, '.quarantine');
    if (!fs.existsSync(quarantineDir)) {
      fs.mkdirSync(quarantineDir, { recursive: true });
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const targetPath = path.join(quarantineDir, `outbox-corrupted-${Date.now()}${ext}`);
      try {
        fs.renameSync(filePath, targetPath);
      } catch {
        // Ignore rename error during quarantine
      }
    }
    console.error(`[OutboxQueue] Quarantined corrupted file: ${reason}`);
  }

  /**
   * On startup, reset stale RESERVED items back to PENDING.
   * Items reserved more than 5 minutes ago are assumed abandoned (gateway crash).
   */
  private recoverStaleReservations(): void {
    const result = this.stmtCache.recoverStale.run();
    if (result.changes > 0) {
      console.log(`[OutboxQueue] Recovered ${result.changes} stale reservations from crashed gateway process.`);
    }
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

  /**
   * On first start, if the legacy outbox-queue.json.enc exists, import its events
   * into the new SQLite database and archive the JSON file.
   */
  private migrateFromJsonIfNeeded(): void {
    const legacyPath = path.join(this.storageDir, 'outbox-queue.json.enc');
    if (!fs.existsSync(legacyPath)) return;

    try {
      const rawEncrypted = fs.readFileSync(legacyPath, 'utf8');
      if (!rawEncrypted) return;
      const jsonStr = this.decrypt(rawEncrypted);
      const items: OutboxItem[] = JSON.parse(jsonStr);
      if (!Array.isArray(items)) {
        this.quarantineFile(legacyPath, 'JSON payload is not an array');
        return;
      }

      const insertMany = this.db.transaction((events: OutboxItem[]) => {
        for (const item of events) {
          const encryptedPayload = this.encrypt(JSON.stringify(item.envelope));
          this.stmtCache.insert.run(item.id, encryptedPayload, item.enqueuedAt);
          if (item.status === 'DEAD_LETTER') {
            this.stmtCache.fail.run(item.retryCount, 'DEAD_LETTER', null, item.id);
          }
        }
      });
      insertMany(items);

      // Archive the legacy file
      const archivePath = path.join(this.storageDir, `outbox-queue-migrated-${Date.now()}.json.enc`);
      fs.renameSync(legacyPath, archivePath);
    } catch (err: any) {
      this.quarantineFile(legacyPath, `Legacy migration failed: ${err.message}`);
    }
  }

  private rowToItem(row: any): OutboxItem {
    let envelope: any;
    try {
      envelope = JSON.parse(this.decrypt(row.payload_encrypted));
    } catch {
      envelope = null; // Corrupted event — will be visible but payload unrecoverable
    }
    return {
      id: row.id,
      envelope,
      retryCount: row.retry_count,
      enqueuedAt: row.enqueued_at,
      nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at * 1000).toISOString() : undefined,
      status: row.status,
    };
  }

  enqueue(envelope: any): OutboxItem {
    if (this.isQuarantined) {
      throw new Error('OUTBOX_QUARANTINED: Outbox queue is quarantined due to prior corruption failure');
    }

    const count = this.stmtCache.count.get().cnt;
    if (count >= this.maxCapacity) {
      throw new Error(`OUTBOX_CAPACITY_EXCEEDED: Queue length ${count} reached capacity limit ${this.maxCapacity}`);
    }

    const id = envelope.clientEventId || `outbox_${crypto.randomUUID()}`;
    const encryptedPayload = this.encrypt(JSON.stringify(envelope));
    const enqueuedAt = new Date().toISOString();

    this.stmtCache.insert.run(id, encryptedPayload, enqueuedAt);

    return {
      id,
      envelope,
      retryCount: 0,
      enqueuedAt,
      status: 'PENDING',
    };
  }

  peekBatch(batchSize: number = 50): OutboxItem[] {
    if (this.isQuarantined) {
      throw new Error('OUTBOX_QUARANTINED: Outbox queue is quarantined due to prior corruption failure');
    }
    const rows = this.stmtCache.selectPending.all(batchSize);
    return rows.map((row: any) => this.rowToItem(row));
  }

  reserveBatch(batchSize: number = 50): OutboxItem[] {
    if (this.isQuarantined) {
      throw new Error('OUTBOX_QUARANTINED: Outbox queue is quarantined due to prior corruption failure');
    }

    const reserveTransaction = this.db.transaction((limit: number) => {
      const rows = this.stmtCache.selectPending.all(limit);
      const reserved: OutboxItem[] = [];
      for (const row of rows) {
        this.stmtCache.reserve.run(row.id);
        const item = this.rowToItem(row);
        item.status = 'RESERVED';
        reserved.push(item);
      }
      return reserved;
    });

    return reserveTransaction(batchSize);
  }

  purgeBatch(idsToPurge: string[]): void {
    if (this.isQuarantined) return;
    const purgeTransaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        this.stmtCache.purge.run(id);
      }
    });
    purgeTransaction(idsToPurge);
  }

  recordFailure(idsToFail: string[]): void {
    if (this.isQuarantined) return;
    const failTransaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        // Read current retry count
        const row = this.db.prepare('SELECT retry_count FROM outbox_events WHERE id = ?').get(id);
        if (!row) continue;

        const newRetry = row.retry_count + 1;
        const isDead = newRetry >= this.maxRetries;
        const jitterMs = Math.floor(Math.random() * 500);
        const backoffSec = Math.pow(2, newRetry) + Math.floor(jitterMs / 1000);
        const nextAttemptAt = Math.floor(Date.now() / 1000) + backoffSec;

        this.stmtCache.fail.run(
          newRetry,
          isDead ? 'DEAD_LETTER' : 'PENDING',
          isDead ? null : nextAttemptAt,
          id
        );
      }
    });
    failTransaction(idsToFail);
  }

  getDeadLetterItems(): OutboxItem[] {
    if (this.isQuarantined) return [];
    const rows = this.stmtCache.selectDeadLetter.all();
    return rows.map((row: any) => this.rowToItem(row));
  }

  size(): number {
    if (this.isQuarantined) {
      throw new Error('OUTBOX_CORRUPTED: Outbox queue is quarantined due to prior corruption failure');
    }
    return this.stmtCache.count.get().cnt;
  }

  clear(): void {
    this.isQuarantined = false;
    this.stmtCache.deleteAll.run();
  }

  /**
   * Transactionally reads and increments a named counter in the SQLite database.
   * Provides durable monotonic sequence numbers that survive process restarts.
   */
  getNextCounter(counterName: string): number {
    if (this.isQuarantined || !this.db) return 1;
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO gateway_counters (counter_name, counter_value)
        VALUES (?, 1)
        ON CONFLICT(counter_name) DO UPDATE SET counter_value = counter_value + 1
      `).run(counterName);
      const row = this.db.prepare(`
        SELECT counter_value FROM gateway_counters WHERE counter_name = ?
      `).get(counterName);
      return row ? Number(row.counter_value) : 1;
    });
    return transaction();
  }

  getCounter(counterName: string): number {
    if (this.isQuarantined || !this.db) return 0;
    const row = this.db.prepare(`
      SELECT counter_value FROM gateway_counters WHERE counter_name = ?
    `).get(counterName);
    return row ? Number(row.counter_value) : 0;
  }

  setCounter(counterName: string, value: number): void {
    if (this.isQuarantined || !this.db) return;
    this.db.prepare(`
      INSERT INTO gateway_counters (counter_name, counter_value)
      VALUES (?, ?)
      ON CONFLICT(counter_name) DO UPDATE SET counter_value = ?
    `).run(counterName, value, value);
  }

  /**
   * Gracefully close the SQLite database connection.
   * Should be called during gateway shutdown.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
