import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The PGlite test database is process-local and the fixtures deliberately
    // reset shared schema state between tests. Serial files keep that state
    // deterministic while the real PostgreSQL suite remains independently
    // opt-in via npm run test:postgres.
    fileParallelism: false,
    maxWorkers: 1,
    // 120 s per hook / test: the PostgreSQL RLS integration test makes many
    // HTTP + DB + argon2id calls inside one it() block. On shared CI runners
    // argon2id alone can take 400-800 ms per hash; 30 s was too tight.
    hookTimeout: 120_000,
    testTimeout: 120_000,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
