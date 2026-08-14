import http from 'http';
import { GatewayAdapter } from '../services/rfid/adapters/gatewayAdapter';
import { OutboxQueue } from './outboxQueue';
import { computeCanonicalSignature } from '../services/rfid/cryptoService';
import path from 'path';

export interface GatewayDaemonOptions {
  schoolId: string;
  readerId: string;
  serverBaseUrl: string;
  sharedSecret: string;
  cardMasterKey?: string;
  storageKey?: string;
  readerName?: string;
  storageDir?: string;
  port?: number;
  useSimulator?: boolean;
}

export class GatewayDaemon {
  private adapter: GatewayAdapter;
  private queue: OutboxQueue;
  private server: http.Server | null = null;
  private running: boolean = false;
  private config: GatewayDaemonOptions;

  constructor(options: GatewayDaemonOptions) {
    this.config = options;

    if (process.env.NODE_ENV === 'production') {
      if (!options.sharedSecret || options.sharedSecret.length < 32) {
        throw new Error('GATEWAY_FATAL: sharedSecret must be at least 32 bytes in production');
      }
      if (!options.cardMasterKey || options.cardMasterKey.length < 32) {
        throw new Error('GATEWAY_FATAL: cardMasterKey must be at least 32 bytes in production');
      }
    }

    const storageDir = options.storageDir || path.join(process.cwd(), 'gateway-data');
    const storageKey = options.storageKey || process.env.GATEWAY_STORAGE_KEY || process.env.RFID_OUTBOX_ENCRYPTION_KEY || options.sharedSecret;
    this.queue = new OutboxQueue({
      storageDir,
      deviceEncryptionKey: storageKey,
    });

    this.adapter = new GatewayAdapter({
      schoolId: options.schoolId,
      readerId: options.readerId,
      sharedSecret: options.sharedSecret,
      cardMasterKey: options.cardMasterKey,
      readerName: options.readerName,
      useSimulator: options.useSimulator,
      outboxQueue: this.queue,
    });
  }

  async start(): Promise<void> {
    console.log(`[GatewayDaemon] Starting RFID Gateway for School ${this.config.schoolId}, Reader ${this.config.readerId}...`);
    await this.adapter.connect();
    this.running = true;

    // Background sync loop for offline outbox items
    this.startOutboxSyncLoop();

    // Start local health/control HTTP server
    const port = this.config.port || 4000;
    this.server = http.createServer(async (req, res) => {
      if (req.url === '/health' || req.url === '/api/v1/health') {
        const health = await this.adapter.getHealth();
        const queueSize = this.queue.size();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'HEALTHY', health, outboxQueueDepth: queueSize }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server?.listen(port, '0.0.0.0', () => {
        console.log(`[GatewayDaemon] Control and health server listening on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.adapter.disconnect();
    this.queue.close();
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
      this.server = null;
    }
    console.log('[GatewayDaemon] Gateway daemon stopped cleanly.');
  }

  async handleCardTap(options: { attendanceSessionId?: string } = {}): Promise<any> {
    const envelope = await this.adapter.readCredential({
      securityMode: 'SECURE',
      attendanceSessionId: options.attendanceSessionId,
    });

    try {
      // Attempt immediate online scan submission
      const response = await fetch(`${this.config.serverBaseUrl}/api/v1/${this.config.schoolId}/rfid/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-reader-id': this.config.readerId,
          'x-reader-signature': envelope.signature || '',
          'x-reader-timestamp': envelope.readerTimestamp,
        },
        body: JSON.stringify(envelope),
      });

      if (response.ok) {
        return await response.json();
      }
      // Server returned 4xx or 5xx — preserve in durable outbox for reconciliation
      this.queue.enqueue({ ...envelope, isOffline: true });
    } catch {
      // Network unreachable — enqueue to durable local SQLite outbox
      this.queue.enqueue({ ...envelope, isOffline: true });
    }
    return { decision: 'ENQUEUED_OFFLINE', envelope };
  }

  private startOutboxSyncLoop(): void {
    const syncInterval = setInterval(async () => {
      if (!this.running) {
        clearInterval(syncInterval);
        return;
      }
      if (this.queue.size() === 0) return;

      const items = this.queue.reserveBatch(25);
      if (items.length === 0) return;

      const timestamp = new Date().toISOString();
      const payload = {
        batchId: `batch_${Date.now()}`,
        readerId: this.config.readerId,
        schoolId: this.config.schoolId,
        events: items.map((i) => i.envelope),
      };

      const signature = computeCanonicalSignature(payload, this.config.sharedSecret);

      try {
        const res = await fetch(`${this.config.serverBaseUrl}/api/v1/${this.config.schoolId}/rfid/offline/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-reader-id': this.config.readerId,
            'x-reader-timestamp': timestamp,
            'x-reader-signature': signature,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          this.queue.purgeBatch(items.map((i) => i.id));
        } else {
          this.queue.recordFailure(items.map((i) => i.id));
        }
      } catch {
        this.queue.recordFailure(items.map((i) => i.id));
      }
    }, 5000);
  }
}

// Runnable CLI entrypoint
if (process.argv[1]?.includes('gatewayDaemon') || process.argv[1]?.includes('gateway.cjs')) {
  const schoolId = process.env.SCHOOL_ID || (process.env.NODE_ENV === 'production' ? '' : '00000000-0000-0000-0000-000000000001');
  const readerId = process.env.RFID_READER_ID || (process.env.NODE_ENV === 'production' ? '' : 'gateway_reader_01');
  const serverBaseUrl = process.env.APP_URL || 'http://localhost:3000';
  const sharedSecret = process.env.RFID_HMAC_SECRET;
  const cardMasterKey = process.env.RFID_CARD_MASTER_KEY;
  const storageKey = process.env.GATEWAY_STORAGE_KEY || process.env.RFID_OUTBOX_ENCRYPTION_KEY;
  const port = parseInt(process.env.GATEWAY_PORT || '4000', 10);
  const useSimulator = process.env.USE_SIMULATOR === 'true' || process.env.NODE_ENV !== 'production';

  if (!schoolId || !readerId) {
    console.error('Fatal: SCHOOL_ID and RFID_READER_ID environment variables are required.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    if (!sharedSecret || !cardMasterKey) {
      console.error('Fatal: RFID_HMAC_SECRET and RFID_CARD_MASTER_KEY are required in production mode.');
      process.exit(1);
    }
  }

  const daemon = new GatewayDaemon({
    schoolId,
    readerId,
    serverBaseUrl,
    sharedSecret: sharedSecret || 'test-secret-32-chars-length-environment',
    cardMasterKey: cardMasterKey || 'test-card-master-key-32-chars-long-env',
    storageKey,
    port,
    useSimulator,
  });

  daemon.start().catch((err) => {
    console.error('Fatal gateway daemon error:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log('Received termination signal, shutting down gateway...');
    await daemon.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
