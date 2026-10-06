// scripts/validate-product-claims-registry.ts
import fs from 'node:fs';

export type Status = 'planned' | 'experimental' | 'software-verified' | 'field-verified' | 'production';

export const NEEDS: Record<Status, { minEvidence: number; types?: string[] }> = {
  planned: { minEvidence: 0 },
  experimental: { minEvidence: 0 },
  'software-verified': { minEvidence: 1, types: ['test', 'load-test'] },
  'field-verified': { minEvidence: 1, types: ['pilot'] },
  production: { minEvidence: 2, types: ['pilot', 'external'] }, // at least one real-world or third-party source
};

export const MAX_EVIDENCE_AGE_DAYS = 365;

export function validateClaimsRegistry(filePath: string = 'docs/product-claims.json'): string[] {
  if (!fs.existsSync(filePath)) {
    return [`Registry file not found: ${filePath}`];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let reg: {
    claims?: Array<{
      id: string;
      subsystem: string;
      status: string;
      summary: string;
      evidence?: Array<{ type: string; ref: string; date?: string }>;
      limitations?: string[];
    }>;
  };
  try {
    reg = JSON.parse(raw);
  } catch (err) {
    return [`Invalid JSON in ${filePath}: ${err}`];
  }

  const errs: string[] = [];
  if (!Array.isArray(reg.claims) || reg.claims.length === 0) {
    return ['Registry claims array is empty or missing'];
  }

  for (const c of reg.claims) {
    const rule = NEEDS[c.status as Status];
    if (!rule) {
      errs.push(`${c.id}: unknown status "${c.status}"`);
      continue;
    }
    const ev = c.evidence ?? [];
    if (ev.length < rule.minEvidence) {
      errs.push(`${c.id}: "${c.status}" needs ≥${rule.minEvidence} evidence item(s)`);
    }
    if (rule.types && !ev.some((e) => rule.types!.includes(e.type))) {
      errs.push(`${c.id}: "${c.status}" needs evidence of type ${rule.types.join(' or ')}`);
    }
    for (const e of ev) {
      if (!e.ref.startsWith('http') && !fs.existsSync(e.ref)) {
        errs.push(`${c.id}: evidence file missing: ${e.ref}`);
      }
      if (e.date && (Date.now() - Date.parse(e.date)) / 86_400_000 > MAX_EVIDENCE_AGE_DAYS) {
        errs.push(`${c.id}: evidence ${e.ref} older than ${MAX_EVIDENCE_AGE_DAYS} days`);
      }
    }
  }

  return errs;
}

if (process.argv[1]?.includes('validate-product-claims-registry')) {
  const errs = validateClaimsRegistry();
  if (errs.length) {
    console.error(`Claims registry validation failed with ${errs.length} error(s):\n`);
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('Product claims registry validation passed.');
}
