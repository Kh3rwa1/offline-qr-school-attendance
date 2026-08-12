import fs from 'node:fs';
import path from 'node:path';
import { closeRedisConnection } from '../src/services/redisService';
import { closeDatabasePools } from '../src/db';

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRatePercent: number;
  requestsPerSecond: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  durationSeconds: number;
}

export async function runLoadSmokeBenchmark(): Promise<LoadTestMetrics> {
  console.log('=== Starting Pull-Request Load Smoke Benchmark ===');
  process.env.NODE_ENV = 'development';
  process.env.TEST_SERVER_STATIC = 'true';
  process.env.RUN_SERVER = 'false';
  process.env.PORT = '0';
  process.env.SESSION_SECRET = 'load-smoke-session-secret-01234567890123456789';

  const { createApp } = await import('../server');
  const app = await createApp();
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const startTime = Date.now();
  const latenciesMs: number[] = [];
  let successful = 0;
  let failed = 0;

  const totalRequests = 200;
  const concurrency = 10;
  const batchCount = totalRequests / concurrency;

  try {
    for (let b = 0; b < batchCount; b++) {
      const batchPromises = Array.from({ length: concurrency }, async (_, idx) => {
        const reqIndex = b * concurrency + idx;
        const reqStart = Date.now();
        try {
          const endpoint = reqIndex % 2 === 0 ? '/livez' : '/readyz';
          const res = await fetch(`${baseUrl}${endpoint}`, {
            signal: AbortSignal.timeout(2000),
          });
          const duration = Date.now() - reqStart;
          latenciesMs.push(duration);
          if (res.ok) {
            successful++;
          } else {
            failed++;
          }
        } catch {
          failed++;
          latenciesMs.push(Date.now() - reqStart);
        }
      });
      await Promise.all(batchPromises);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedisConnection();
    await closeDatabasePools();
  }

  const durationSeconds = (Date.now() - startTime) / 1000;
  latenciesMs.sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    if (latenciesMs.length === 0) return 0;
    const index = Math.ceil((p / 100) * latenciesMs.length) - 1;
    return latenciesMs[Math.max(0, Math.min(index, latenciesMs.length - 1))];
  };

  const metrics: LoadTestMetrics = {
    totalRequests,
    successfulRequests: successful,
    failedRequests: failed,
    errorRatePercent: Number(((failed / totalRequests) * 100).toFixed(2)),
    requestsPerSecond: Number((totalRequests / durationSeconds).toFixed(2)),
    p50Ms: getPercentile(50),
    p90Ms: getPercentile(90),
    p95Ms: getPercentile(95),
    p99Ms: getPercentile(99),
    durationSeconds: Number(durationSeconds.toFixed(2)),
  };

  console.log('Load Smoke Metrics:', metrics);

  if (metrics.errorRatePercent > 1) {
    throw new Error(`LOAD_SMOKE_FAILED: Error rate ${metrics.errorRatePercent}% exceeds threshold 1%`);
  }

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, 'load-smoke-report.json'),
    JSON.stringify(metrics, null, 2)
  );

  console.log('=== Load Smoke Benchmark Report Saved to output/load-smoke-report.json ===');
  return metrics;
}

if (process.argv[1]?.includes('runLoadSmokeBenchmark')) {
  runLoadSmokeBenchmark()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Load smoke benchmark failed:', err);
      process.exit(1);
    });
}
