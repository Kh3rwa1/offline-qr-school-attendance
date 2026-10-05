// scripts/any-ratchet.ts      usage: tsx scripts/any-ratchet.ts [--update]
import { ESLint } from 'eslint';
import fs from 'node:fs';

const BASELINE = '.any-baseline.json';
const eslint = new ESLint({
  overrideConfig: [{ rules: { '@typescript-eslint/no-explicit-any': 'error' } }],
});

const results = await eslint.lintFiles(['src/**/*.{ts,tsx}', 'server.ts', 'sms-worker.ts']);
const counts: Record<string, number> = {};
for (const r of results) {
  const n = r.messages.filter((m) => m.ruleId === '@typescript-eslint/no-explicit-any').length;
  if (n) counts[r.filePath.replace(process.cwd() + '/', '')] = n;
}

if (process.argv.includes('--update')) {
  const sorted: Record<string, number> = {};
  for (const k of Object.keys(counts).sort()) {
    sorted[k] = counts[k]!;
  }
  fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline: ${Object.values(counts).reduce((a, b) => a + b, 0)} any across ${Object.keys(counts).length} files`);
  process.exit(0);
}

const base: Record<string, number> = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const regressions = Object.entries(counts).filter(([f, n]) => n > (base[f] ?? 0));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);

if (regressions.length) {
  console.error('`any` count increased:');
  for (const [f, n] of regressions) console.error(`  ${f}: ${base[f] ?? 0} → ${n}`);
  process.exit(1);
}
console.log(`any: ${total} (baseline ${baseTotal})${total < baseTotal ? ' — run with --update to lock in progress' : ''}`);
