// scripts/check-docs-freshness.ts
import fs from 'node:fs';
import { globSync } from 'node:fs';

const MAX_AGE_DAYS: Record<string, number> = {
  'docs/operations/': 120, // operators act on these; must stay current
  'docs/reference/': 180,
  'docs/explanation/': 365,
};

const problems: string[] = [];

for (const f of globSync('docs/**/*.md').filter((f) => !f.startsWith('docs/archive/') && !f.includes('/archive/'))) {
  const content = fs.readFileSync(f, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---/.exec(content)?.[1];
  if (!fm) {
    problems.push(`${f}: missing front matter`);
    continue;
  }
  const get = (k: string) => new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, 'm').exec(fm)?.[1];
  for (const k of ['title', 'owner', 'last_verified']) {
    if (!get(k)) problems.push(`${f}: missing ${k}`);
  }
  const limit = Object.entries(MAX_AGE_DAYS).find(([p]) => f.startsWith(p))?.[1];
  const lv = get('last_verified');
  if (limit && lv) {
    const age = (Date.now() - new Date(lv).getTime()) / 86_400_000;
    if (age > limit) problems.push(`${f}: last verified ${Math.floor(age)}d ago (limit ${limit}d)`);
  }
}

if (problems.length) {
  console.error(`Docs freshness errors:\n${problems.join('\n')}`);
  process.exit(1);
}

console.log('Docs freshness OK');
