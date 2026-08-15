import fs from 'node:fs';
import { processNotificationQueue } from './src/services/notificationWorker';
import { getSmsProvider } from './src/services/sms/smsProvider';
import { reconcileStuckSessions } from './src/services/sessionReconciler';

const baseIntervalMs = Number(process.env.SMS_WORKER_INTERVAL_MS || 15000);
const maxBackoffMs = 60000;
let currentIntervalMs = baseIntervalMs;
let consecutiveFailures = 0;

const heartbeatFile = process.env.WORKER_HEARTBEAT_FILE || '/tmp/worker-heartbeat';
let isRunningQueue = false;
let isRunningReconciler = false;
let isShuttingDown = false;
let queueTimeoutHandle: NodeJS.Timeout | null = null;
let reconcilerIntervalHandle: NodeJS.Timeout | null = null;

function updateHeartbeat() {
  try {
    fs.writeFileSync(heartbeatFile, new Date().toISOString());
  } catch (err: any) {
    console.error('Failed to update worker heartbeat file:', err.message);
  }
}

async function tickQueue() {
  if (isRunningQueue || isShuttingDown) return;
  isRunningQueue = true;
  try {
    const result = await processNotificationQueue();
    if (result.processed > 0) {
      console.log(`[SMSWorker] Processed ${result.processed} notifications: ${result.sent} sent, ${result.failed} failed, ${result.permanentFailures} permanentFailures`);
    }
    // Success: reset backoff
    consecutiveFailures = 0;
    currentIntervalMs = baseIntervalMs;
    updateHeartbeat();
  } catch (error: any) {
    consecutiveFailures++;
    currentIntervalMs = Math.min(maxBackoffMs, baseIntervalMs * Math.pow(2, Math.min(consecutiveFailures, 4)));
    console.error(`[SMSWorker] Queue batch failed (failure count: ${consecutiveFailures}, backing off to ${currentIntervalMs}ms):`, error.message || error);
    updateHeartbeat();
  } finally {
    isRunningQueue = false;
    if (!isShuttingDown) {
      queueTimeoutHandle = setTimeout(tickQueue, currentIntervalMs);
    }
  }
}

async function tickReconciler() {
  if (isRunningReconciler || isShuttingDown) return;
  isRunningReconciler = true;
  try {
    const result = await reconcileStuckSessions(15);
    if (result.reconciledCount > 0) {
      console.log(`[SessionReconciler] Autonomous tick: finalized ${result.reconciledCount} stuck sessions.`);
    }
  } catch (error: any) {
    console.error('[SessionReconciler] Reconciler tick error:', error.message || error);
  } finally {
    isRunningReconciler = false;
  }
}

console.log(`[SMSWorker] Autonomous daemon started; base polling every ${baseIntervalMs}ms`);

try {
  getSmsProvider();
  updateHeartbeat();
} catch (error) {
  console.error('[SMSWorker] Cannot start with configured SMS provider:', error);
  process.exit(1);
}

// Start autonomous loops
void tickQueue();
reconcilerIntervalHandle = setInterval(tickReconciler, 60000);
// Run an initial reconciler check on startup
void tickReconciler();

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[SMSWorker] Received ${signal}. Shutting down worker gracefully...`);

  if (queueTimeoutHandle) clearTimeout(queueTimeoutHandle);
  if (reconcilerIntervalHandle) clearInterval(reconcilerIntervalHandle);

  // Give in-flight tasks up to 3 seconds to complete
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
