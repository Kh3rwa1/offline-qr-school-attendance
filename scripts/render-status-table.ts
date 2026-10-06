// scripts/render-status-table.ts — writes between markers in README.md
import fs from 'node:fs';

const BADGE: Record<string, string> = {
  planned: 'Planned',
  experimental: 'Experimental',
  'software-verified': 'Software-verified',
  'field-verified': 'Field-verified',
  production: 'Production',
};

const reg = JSON.parse(fs.readFileSync('docs/product-claims.json', 'utf8'));

const rows = reg.claims.map((c: any) =>
  `| **${c.subsystem}** | \`${BADGE[c.status] || c.status}\` | ${c.summary}${c.limitations?.length ? ` _Limits: ${c.limitations.join('; ')}._` : ''} | ${c.evidence?.map((e: any) => `[${e.type}](${e.ref})`).join(', ') || '—'} |`
);

const table = [
  '| Subsystem | Status | What that means | Evidence |',
  '|---|---|---|---|',
  ...rows,
].join('\n');

const readme = fs.readFileSync('README.md', 'utf8');

if (!readme.includes('<!-- status:start -->') || !readme.includes('<!-- status:end -->')) {
  console.error('README.md missing <!-- status:start --> or <!-- status:end --> marker tags.');
  process.exit(1);
}

const updatedReadme = readme.replace(
  /<!-- status:start -->[\s\S]*<!-- status:end -->/,
  `<!-- status:start -->\n${table}\n<!-- status:end -->`
);

fs.writeFileSync('README.md', updatedReadme);
console.log('README.md status table rendered successfully.');
