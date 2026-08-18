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

    // Coverage thresholds — run with `vitest run --coverage`
    // These are minimum acceptable percentages; a CI run fails if coverage drops below them.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/db/seed*.ts',
        'src/db/migrate.ts',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/serviceWorkerRegistration.ts',
      ],
      thresholds: {
        // Baselines derived from actual coverage as of initial threshold setup.
        // Rounded down to nearest 5 % so CI fails only on regression, not on
        // today's existing gaps. Raise these incrementally as test coverage grows.
        lines: 40,
        functions: 30,
        branches: 30,
        statements: 40,
      },
    },
  },
});
