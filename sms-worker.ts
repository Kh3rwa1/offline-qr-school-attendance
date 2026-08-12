import { processNotificationQueue } from './src/services/notificationWorker';

const intervalMs = Number(process.env.SMS_WORKER_INTERVAL_MS || 5000);
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await processNotificationQueue();
    if (result.processed > 0) console.log('SMS worker batch', result);
  } catch (error) {
    console.error('SMS worker batch failed', error);
  } finally {
    running = false;
  }
}

console.log(`SMS worker started; polling every ${intervalMs}ms`);
void tick();
const timer = setInterval(() => void tick(), intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
