// scripts/check-generated-docs.ts
import { execFileSync } from 'node:child_process';
import { generateEnvDocs } from './gen-env-example';
import { generateOpenApi } from './gen-openapi';
import { generateDecisionsDoc } from './gen-decisions-doc';

console.log('[check:generated] Generating reference docs from codebase...');

generateEnvDocs();
generateOpenApi();
generateDecisionsDoc();

console.log('[check:generated] Verifying zero git diff against tracked artifacts...');

try {
  execFileSync(
    'git',
    [
      'diff',
      '--exit-code',
      '.env.example',
      'docs/reference/configuration.md',
      'docs/reference/openapi.json',
      'docs/reference/decisions.md',
    ],
    { stdio: 'inherit' }
  );
  console.log('✅ Generated reference docs are fully up to date with zero drift.');
} catch (err: unknown) {
  console.error(
    '\n❌ Drift detected in generated reference docs!\n' +
      'Run `npm run gen:all` to regenerate .env.example, configuration.md, openapi.json, and decisions.md.'
  );
  process.exit(1);
}
