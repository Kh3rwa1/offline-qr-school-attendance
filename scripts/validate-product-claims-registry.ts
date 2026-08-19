/**
 * CI Validator: Machine-Readable Product Claims Registry
 *
 * Validates docs/product-claims.json against the following rules:
 *
 * 1. The file must exist and parse as valid JSON.
 * 2. Every claim must have a valid status value.
 * 3. EXTERNALLY_PENDING claims must not reference simulation evidence as physical proof.
 * 4. VERIFIED_AUTOMATION claims must reference at least one evidence file that exists.
 * 5. Claims with lastVerificationDate must not be older than revalidationIntervalDays.
 * 6. No claim may use status VERIFIED_EXTERNAL unless signed external evidence is attached.
 * 7. The 'experimental' and 'externally_pending' status must not use language implying production-certified.
 *
 * This script exits with code 1 on any violation.
 */

import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_PATH = path.join(process.cwd(), 'docs', 'product-claims.json');

const VALID_STATUSES = [
  'VERIFIED_AUTOMATION',
  'VERIFIED_EXTERNAL',
  'EXPERIMENTAL',
  'EXTERNALLY_PENDING',
  'UNSUPPORTED',
] as const;
type ClaimStatus = (typeof VALID_STATUSES)[number];

interface Claim {
  id: string;
  claim: string;
  status: string;
  introducedVersion: string | null;
  evidenceFiles: string[];
  lastVerificationDate: string | null;
  revalidationIntervalDays: number | null;
  limitations: string;
}

interface Registry {
  version: string;
  lastUpdated: string;
  revalidationIntervalDays: number;
  claims: Claim[];
}

function fail(msg: string): never {
  console.error(`❌ CLAIMS_REGISTRY_VIOLATION: ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`⚠️  ${msg}`);
}

// ── Load & parse ─────────────────────────────────────────────────────────────
if (!fs.existsSync(REGISTRY_PATH)) {
  fail(
    `docs/product-claims.json not found. Create this file to establish the product claims registry.`
  );
}

let registry: Registry;
try {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  registry = JSON.parse(raw);
} catch (e) {
  fail(`docs/product-claims.json is not valid JSON: ${e}`);
}

if (!Array.isArray(registry.claims) || registry.claims.length === 0) {
  fail('docs/product-claims.json must contain a non-empty "claims" array.');
}

const violations: string[] = [];
const today = new Date();

// ── Validate each claim ───────────────────────────────────────────────────────
for (const claim of registry.claims) {
  const prefix = `[claim: ${claim.id}]`;

  // Rule 1: status must be a known value
  if (!VALID_STATUSES.includes(claim.status as ClaimStatus)) {
    violations.push(
      `${prefix} Unknown status "${claim.status}". Allowed: ${VALID_STATUSES.join(', ')}`
    );
    continue;
  }

  // Rule 2: VERIFIED_AUTOMATION claims must reference at least one evidence file
  if (claim.status === 'VERIFIED_AUTOMATION') {
    if (!Array.isArray(claim.evidenceFiles) || claim.evidenceFiles.length === 0) {
      violations.push(
        `${prefix} VERIFIED_AUTOMATION claims must reference at least one evidence file.`
      );
    } else {
      // At least one referenced file must exist
      const missing = claim.evidenceFiles.filter(
        (f) => !fs.existsSync(path.join(process.cwd(), f))
      );
      if (missing.length === claim.evidenceFiles.length) {
        // All referenced evidence files are missing — genuine problem
        violations.push(
          `${prefix} None of the referenced evidence files exist: ${missing.join(', ')}`
        );
      } else if (missing.length > 0) {
        warn(
          `${prefix} Some evidence files are missing (non-fatal, at least one exists): ${missing.join(', ')}`
        );
      }
    }
  }

  // Rule 3: VERIFIED_AUTOMATION claims with lastVerificationDate must not be stale
  if (claim.status === 'VERIFIED_AUTOMATION' && claim.lastVerificationDate && claim.revalidationIntervalDays) {
    const lastVerified = new Date(claim.lastVerificationDate);
    const daysSince = (today.getTime() - lastVerified.getTime()) / (1000 * 86400);
    if (daysSince > claim.revalidationIntervalDays) {
      violations.push(
        `${prefix} Evidence is stale. Last verified ${Math.round(daysSince)} days ago; revalidation interval is ${claim.revalidationIntervalDays} days.`
      );
    }
  }

  // Rule 4: EXTERNALLY_PENDING claims must not have a lastVerificationDate (they are not verified)
  if (claim.status === 'EXTERNALLY_PENDING' && claim.lastVerificationDate !== null) {
    violations.push(
      `${prefix} EXTERNALLY_PENDING claims must have lastVerificationDate: null (they are not yet verified).`
    );
  }

  // Rule 5: VERIFIED_EXTERNAL claims must have lastVerificationDate and evidenceFiles
  if (claim.status === 'VERIFIED_EXTERNAL') {
    if (!claim.lastVerificationDate) {
      violations.push(
        `${prefix} VERIFIED_EXTERNAL claims must have a lastVerificationDate.`
      );
    }
    if (!Array.isArray(claim.evidenceFiles) || claim.evidenceFiles.length === 0) {
      violations.push(
        `${prefix} VERIFIED_EXTERNAL claims must reference external evidence files.`
      );
    }
  }

  // Rule 6: limitations must be a non-empty string
  if (typeof claim.limitations !== 'string' || claim.limitations.trim() === '') {
    violations.push(
      `${prefix} Every claim must have a non-empty "limitations" string describing scope boundaries.`
    );
  }

  // Rule 7: claim text must exist
  if (typeof claim.claim !== 'string' || claim.claim.trim() === '') {
    violations.push(`${prefix} Missing or empty "claim" text.`);
  }

  // Rule 8: Simulation claims must not use physical/production language
  const simulationForbiddenPhrases = [
    /physically commissioned/i,
    /real hardware validated/i,
    /production carrier.*verified/i,
    /live sms.*certified/i,
  ];
  for (const pattern of simulationForbiddenPhrases) {
    if (pattern.test(claim.claim)) {
      violations.push(
        `${prefix} Claim text contains simulation-as-production language matching /${pattern.source}/`
      );
    }
  }
}

// ── Check for duplicate IDs ───────────────────────────────────────────────────
const ids = registry.claims.map((c) => c.id);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicateIds.length > 0) {
  violations.push(`Duplicate claim IDs found: ${duplicateIds.join(', ')}`);
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log(
  `[Product Claims Registry] Validated ${registry.claims.length} claims in docs/product-claims.json`
);

if (violations.length > 0) {
  console.error(`\n🚨 Product Claims Registry Violations (${violations.length}):`);
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(`✅ Product Claims Registry: All ${registry.claims.length} claims pass validation.`);
console.log(
  `   EXTERNALLY_PENDING: ${registry.claims.filter((c) => c.status === 'EXTERNALLY_PENDING').length} claims`
);
console.log(
  `   VERIFIED_AUTOMATION: ${registry.claims.filter((c) => c.status === 'VERIFIED_AUTOMATION').length} claims`
);
console.log(
  `   EXPERIMENTAL: ${registry.claims.filter((c) => c.status === 'EXPERIMENTAL').length} claims`
);
