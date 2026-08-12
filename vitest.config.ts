import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The PGlite test database is process-local and the fixtures deliberately
    // reset shared schema state between tests. Serial files keep that state
    // deterministic while the real PostgreSQL suite remains independently
    // opt-in via npm run test:postgres.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
