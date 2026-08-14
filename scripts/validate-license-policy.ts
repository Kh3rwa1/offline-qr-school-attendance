import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC0-1.0',
  '0BSD',
  'Unlicense',
  'Python-2.0',
  'WTFPL',
  'Public Domain',
]);

export interface LicenseValidationResult {
  passed: boolean;
  totalDependenciesChecked: number;
  prohibitedCount: number;
  unknownCount: number;
  licenseDetails: Record<string, string>;
  violations: Array<{ package: string; license: string; reason: string }>;
}

export function validateLicensePolicy(): LicenseValidationResult {
  console.log('=== Executing Production Dependency License Policy Audit ===');
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const prodDeps = Object.keys(pkgJson.dependencies || {});
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');

  const licenseDetails: Record<string, string> = {};
  const violations: Array<{ package: string; license: string; reason: string }> = [];
  let prohibitedCount = 0;
  let unknownCount = 0;

  for (const dep of prodDeps) {
    const depPkgPath = path.join(nodeModulesDir, dep, 'package.json');
    let license = 'UNKNOWN';

    if (fs.existsSync(depPkgPath)) {
      try {
        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
        if (typeof depPkg.license === 'string') {
          license = depPkg.license;
        } else if (typeof depPkg.license === 'object' && depPkg.license?.type) {
          license = depPkg.license.type;
        } else if (Array.isArray(depPkg.licenses) && depPkg.licenses[0]?.type) {
          license = depPkg.licenses[0].type;
        }
      } catch {
        license = 'UNKNOWN';
      }
    }

    // Standardize license format e.g. (MIT OR Apache-2.0)
    const normalized = license.replace(/[()]/g, '').trim();
    licenseDetails[dep] = license;

    const parts = normalized.split(/\s+(?:OR|AND)\s+/i);
    const isAllowed = parts.some((part) => ALLOWED_LICENSES.has(part.trim()));

    if (license === 'UNKNOWN') {
      unknownCount++;
      violations.push({ package: dep, license, reason: 'Unknown or unparsed license' });
    } else if (!isAllowed) {
      prohibitedCount++;
      violations.push({ package: dep, license, reason: 'License not in allowed production list' });
    }
  }

  const passed = prohibitedCount === 0;

  const result: LicenseValidationResult = {
    passed,
    totalDependenciesChecked: prodDeps.length,
    prohibitedCount,
    unknownCount,
    licenseDetails,
    violations,
  };

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'license-policy-report.json'), JSON.stringify(result, null, 2));

  return result;
}

if (process.argv[1]?.includes('validate-license-policy')) {
  try {
    const res = validateLicensePolicy();
    if (!res.passed) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('License policy validation failed:', err);
    process.exit(1);
  }
}
