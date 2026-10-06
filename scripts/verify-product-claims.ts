import fs from 'node:fs';
import { globSync } from 'node:fs';

export interface Rule {
  id: string;
  regex: RegExp;
  label: string;
}

export const RULES: Rule[] = [
  { id: 'udise', regex: /UDISE\+\s*(compliant|certified|verified\s+by|approved)/i, label: 'UDISE+ compliance claim' },
  { id: 'gov', regex: /government[\s-]*(approved|certified|standard)|govt\.?\s*standard|official\s+government\s+format/i, label: 'Government approval claim' },
  { id: 'dpdp', regex: /DPDP[\s-]*(compliant|certified|approved)|compliant\s+with\s+(the\s+)?DPDP/i, label: 'DPDP compliance claim' },
  { id: 'indep', regex: /independent(ly)?\s+(audit(ed)?|certif(ied|ication)|verif(ied|ication))/i, label: 'Independence claim' },
  { id: 'cert', regex: /\b(production|hardware|site)\s+certif(ied|ication)\b|\b10\s*\/\s*10\b/i, label: 'Self-certification claim' },
  { id: 'guarantee', regex: /\bguarantee[sd]?\b|\b100\s*%\s*(accura|reliab|uptime)/i, label: 'Guarantee claim' },
  { id: 'enterprise', regex: /\benterprise[\s-]grade\b|\bbank[\s-]grade\b|\bmilitary[\s-]grade\b/i, label: 'Marketing grade claim' },
];

// Explicit, reviewable exemptions only:
// <!-- claims-allow: dpdp | quoting the law's name in the legal review section -->
// // claims-allow: cert | rule definition
export const ALLOW_RE = /claims-allow:\s*([a-z,\s]+)\|\s*(.{10,})/;
export const SCAN = [
  'README.md',
  'index.html',
  'CHANGELOG.md',
  'THREAT_MODEL.md',
  'SECURITY.md',
  'docs/**/*.{md,json}',
  'src/**/*.{ts,tsx,json}',
  'public/**/*.{html,json}',
];
export const SKIP = new Set([
  'scripts/verify-product-claims.ts',
  'tests/productClaimsGuardrail.test.ts',
  'src/config/productClaims.ts',
]);

export interface Violation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

export function runGuardrailOn(files: Record<string, string>): { violations: Violation[] } {
  const violations: Violation[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (SKIP.has(file) || file.startsWith('docs/archive/') || file.includes('/archive/')) continue;
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      // Join with next line so claims split across a soft-wrapped paragraph still match
      const window = `${line} ${lines[i + 1] ?? ''}`;
      const allow = ALLOW_RE.exec(line) ?? ALLOW_RE.exec(lines[i - 1] ?? '');
      const allowed = new Set(allow?.[1]?.split(',').map((s) => s.trim()) ?? []);

      for (const r of RULES) {
        if (!r.regex.test(window) || allowed.has(r.id)) continue;
        if (!r.regex.test(line) && r.regex.test(lines[i + 1] ?? '')) continue; // reported on the next line instead
        violations.push({
          file,
          line: i + 1,
          rule: `${r.id}: ${r.label}`,
          snippet: line.trim().slice(0, 140),
        });
      }
    });
  }
  return { violations };
}

export function scanRepository(): Violation[] {
  const allFiles = Array.from(new Set(SCAN.flatMap((g) => globSync(g))));
  const fileContents: Record<string, string> = {};
  for (const file of allFiles) {
    if (SKIP.has(file) || file.startsWith('docs/archive/') || file.includes('/archive/')) continue;
    try {
      if (fs.statSync(file).isFile()) {
        fileContents[file] = fs.readFileSync(file, 'utf8');
      }
    } catch {
      // ignore
    }
  }
  return runGuardrailOn(fileContents).violations;
}

if (process.argv[1]?.includes('verify-product-claims')) {
  const violations = scanRepository();
  if (violations.length) {
    console.error(`Claims guardrail: ${violations.length} unsupported claim(s)\n`);
    for (const v of violations) console.error(`  ${v.file}:${v.line} [${v.rule}]\n    ${v.snippet}\n`);
    console.error('Fix the copy, or add an explicit `claims-allow: <rule> | <reason>` marker for review.');
    process.exit(1);
  }
  console.log('Claims guardrail passed.');
}
