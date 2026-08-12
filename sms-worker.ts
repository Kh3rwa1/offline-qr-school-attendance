import fs from 'node:fs';
import { processNotificationQueue } from './src/services/notificationWorker';
import { getSmsProvider } from './src/services/sms/smsProvider';

const intervalMs = Number(process.env.SMS_WORKER_INTERVAL_MS || 5000);
const heartbeatFile = process.env.WORKER_HEARTBEAT_FILE || '/tmp/worker-heartbeat';
let running = false;

function updateHeartbeat() {
  try {
    fs.writeFileSync(heartbeatFile, new Date().toISOString());
  } catch (err: any) {
    console.error('Failed to update worker heartbeat file:', err.message);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await processNotificationQueue();
    if (result.processed > 0) console.log('SMS worker batch', result);
    updateHeartbeat();
  } catch (error) {
    console.error('SMS worker batch failed', error);
  } finally {
    running = false;
  }
}

console.log(`SMS worker started; polling every ${intervalMs}ms`);
try {
  getSmsProvider();
  updateHeartbeat();
} catch (error) {
  console.error('SMS worker cannot start with the configured provider:', error);
  process.exit(1);
}
void tick();
const timer = setInterval(() => void tick(), intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
