import fs from 'fs';
import path from 'path';

/**
 * CI Guardrail: Product Marketing Claims Verifier
 *
 * Scans all source files, documentation, and metadata to ensure no unsupported
 * government certification, DPDP legal compliance, or unverified hardware/performance
 * claims exist in public-facing copy.
 */

interface ProhibitedPattern {
  regex: RegExp;
  label: string;
}

const PROHIBITED_PUBLIC_PATTERNS: ProhibitedPattern[] = [
  { regex: /UDISE\+\s*(compliant|certified|verified\s*by|approved)/i, label: 'Unsupported UDISE+ compliance/certification claim' },
  { regex: /government[\s-]*(approved|certified|ready\s*reports|standard)/i, label: 'Unsupported government approval/standard claim' },
  { regex: /govt\s*standard/i, label: 'Unsupported govt standard claim' },
  { regex: /official\s*government\s*format/i, label: 'Unsupported official government format claim' },
  { regex: /guaranteed\s*(portal\s*)?acceptance/i, label: 'Unsupported guaranteed acceptance claim' },
  { regex: /DPDP\s*(compliant|certified|legal\s*guarantee)/i, label: 'Unsupported DPDP certification claim' },
  { regex: /Protected\s*under\s*India['’]s\s*DPDP\s*law(?!\s*and\s*access\s*controls)/i, label: 'Unsupported DPDP protection guarantee' },
  { regex: /independently\s*certified/i, label: 'Unsupported independent certification claim' },
  { regex: /hardware\s*certified\s*10\/10/i, label: 'Fabricated hardware 10/10 certification claim' },
  { regex: /10\/10\s*certified/i, label: 'Fabricated 10/10 certified claim' },
  { regex: /officially\s*validated/i, label: 'Unsupported officially validated claim' },
];

// Directories and files to scan
const TARGET_PATHS = [
  'src',
  'README.md',
  'index.html',
  'docs/STATUS.md',
  'docs/performance',
  'docs/hardware',
];

// Files or directories explicitly exempt from scan (e.g. guardrail definitions, audit baselines)
const EXEMPT_FILES = [
  'scripts/verify-product-claims.ts',
  'scripts/verify-no-forbidden-strings.ts',
  'src/config/productClaims.ts',
  'docs/audits/TRUTH_LOCALIZATION_BASELINE.md',
  'tests/productClaimsGuardrail.test.ts',
  'docs/audits/INTERNAL_TECHNICAL_READINESS_REPORT.md',
  'docs/audits/EXTERNAL_VALIDATION_REGISTER.md',
];

interface Violation {
  file: string;
  line: number;
  label: string;
  snippet: string;
}

const violations: Violation[] = [];

function isLineExempt(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return true;
  }
  if (
    line.includes('prohibitedPhrases') ||
    line.includes('PROHIBITED') ||
    line.includes('FORBIDDEN') ||
    line.includes('prohibited') ||
    line.includes('historical') ||
    line.includes('Historical') ||
    line.includes('ANTI-PATTERN') ||
    line.includes('TRUTH_POLICY') ||
    line.includes('does not claim') ||
    line.includes('not claim') ||
    line.includes('does not guarantee') ||
    line.includes('not guaranteed') ||
    line.includes('No specific') ||
    line.includes('Replace:') ||
    line.includes('With:') ||
    line.includes('regex:') ||
    line.includes('label:')
  ) {
    return true;
  }
  return false;
}

function scanFile(filePath: string) {
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (EXEMPT_FILES.some((ex) => relPath === ex || relPath.endsWith(ex))) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (isLineExempt(line)) return;

    for (const pattern of PROHIBITED_PUBLIC_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: relPath,
          line: index + 1,
          label: pattern.label,
          snippet: line.trim(),
        });
      }
    }
  });
}

function traversePath(targetPath: string) {
  const fullPath = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(fullPath)) return;

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    scanFile(fullPath);
  } else if (stat.isDirectory()) {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      traversePath(path.join(targetPath, entry.name));
    }
  }
}

console.log('[CI Claims Guardrail] Scanning public copy & metadata for truthful compliance...');
for (const p of TARGET_PATHS) {
  traversePath(p);
}

if (violations.length > 0) {
  console.error(`\n🚨 Product Claims Guardrail Failed: Found ${violations.length} prohibited public claim(s):`);
  for (const v of violations) {
    console.error(`  - [${v.file}:${v.line}] ${v.label}`);
    console.error(`    Snippet: ${v.snippet}\n`);
  }
  process.exit(1);
} else {
  console.log('✅ Product Claims Guardrail Passed: All public copy satisfies truth standards.');
  process.exit(0);
}
