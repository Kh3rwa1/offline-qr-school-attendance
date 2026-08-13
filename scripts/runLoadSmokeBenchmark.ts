import fs from 'node:fs';
import path from 'node:path';
import { runFullScaleLoadTest } from './runFullScaleLoadTest';
import { closeRedisConnection } from '../src/services/redisService';
import { closeDatabasePools } from '../src/db';

export async function runLoadSmokeBenchmark() {
  console.log('=== Executing Authentic Pull-Request Business Load Smoke Gate ===');
  const report = await runFullScaleLoadTest(false, 30);

  const metrics = {
    totalRequests: report.totalBusinessRequests,
    successfulRequests: report.successfulRequests,
    failedRequests: report.unexpectedFailures,
    errorRatePercent: report.overallErrorRatePercent,
    requestsPerSecond: report.overallRps,
    durationSeconds: report.durationSeconds,
    compliancePassed: report.compliancePassed,
  };

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

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
