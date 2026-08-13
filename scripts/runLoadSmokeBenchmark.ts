import fs from 'node:fs';
import path from 'node:path';
import { runFullScaleLoadTest } from './runFullScaleLoadTest';
import { closeRedisConnection } from '../src/services/redisService';
import { closeDatabasePools } from '../src/db';

export async function runLoadSmokeBenchmark() {
  console.log('=== Executing Authentic Pull-Request Business Load Smoke Gate ===');
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Run migrations and seed/setup with fail-closed error handling
  try {
    const { runMigrations } = await import('../src/db/migrate');
    const { seedDatabase } = await import('../src/db/seed');
    await runMigrations();
    await seedDatabase();
  } catch (err: any) {
    const failureReport = {
      phase: 'ENVIRONMENT_SETUP',
      errorType: err.name || 'SETUP_ERROR',
      message: err.message || 'Migration or database seed failed',
      timestamp: new Date().toISOString(),
      compliancePassed: false,
    };
    fs.writeFileSync(
      path.join(outputDir, 'load-smoke-report.json'),
      JSON.stringify(failureReport, null, 2)
    );
    console.error('Migration/seed setup failed during load smoke benchmark:', err);
    throw new Error(`LOAD_SMOKE_SETUP_FAILED: ${err.message}`);
  }

  let report: any;
  try {
    report = await runFullScaleLoadTest(false, 30);
  } catch (err: any) {
    fs.writeFileSync(
      path.join(outputDir, 'load-smoke-report.json'),
      JSON.stringify({ error: err.message, timestamp: new Date().toISOString(), compliancePassed: false }, null, 2)
    );
    throw err;
  }

  const metrics = {
    totalRequests: report.totalBusinessRequests,
    successfulRequests: report.successfulRequests,
    failedRequests: report.unexpectedFailures,
    errorRatePercent: report.overallErrorRatePercent,
    requestsPerSecond: report.overallRps,
    durationSeconds: report.durationSeconds,
    compliancePassed: report.compliancePassed,
  };

  fs.writeFileSync(
    path.join(outputDir, 'load-smoke-report.json'),
    JSON.stringify(metrics, null, 2)
  );

  console.log('=== Load Smoke Benchmark Complete ===');
  if (!report.compliancePassed) {
    throw new Error(`LOAD_SMOKE_FAILED: Business load smoke gate failed with error rate ${report.overallErrorRatePercent}%`);
  }

  return metrics;
}

if (process.argv[1]?.includes('runLoadSmokeBenchmark')) {
  runLoadSmokeBenchmark()
    .then(async () => {
      await closeRedisConnection();
      await closeDatabasePools();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Load smoke benchmark failed:', err);
      await closeRedisConnection();
      await closeDatabasePools();
      process.exit(1);
    });
}
