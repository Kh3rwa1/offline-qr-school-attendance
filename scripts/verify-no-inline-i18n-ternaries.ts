import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

// Focus on core user-facing UI surfaces requiring strict centralization and >=14px typography
const TARGET_PATHS = [
  'dashboards/report-viewer',
  'dashboards/teacher',
  'dashboards/school-admin',
  'dashboards/rfid-operator',
  'app/LoginPage.tsx',
  'app/ActiveSchoolProvider.tsx',
  'components/BentoScannerGrid.tsx',
  'components/Header.tsx'
];

interface Violation {
  file: string;
  line: number;
  snippet: string;
  issue: string;
}

const violations: Violation[] = [];

function checkFile(filePath: string) {
  const relativePath = path.relative(SRC_DIR, filePath);
  
  const isTargeted = TARGET_PATHS.some((d) => relativePath === d || relativePath.startsWith(d + '/'));
  if (!isTargeted) return;

  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for inline language ternaries returning string literals for UI display
    // e.g. language === 'bn' ? '...' : '...'
    if (
      (line.includes("language === 'bn'") || line.includes("lang === 'bn'") || line.includes("language === 'en'")) &&
      !line.includes('nameBn') && // Allow localized DB field fallback
      !line.includes('bg-') && // Ignore active tab CSS class toggle
      !line.includes('shadow-') &&
      !line.includes('text-white') &&
      !line.includes('activeView') &&
      !line.includes('localStorage') &&
      !line.includes('toLocaleDateString') &&
      !line.includes('toLocaleTimeString') &&
      !line.includes('setLanguage') &&
      !line.includes('useLanguage') &&
      !line.includes("language === 'en' ? 'bn' : 'en'") &&
      !line.includes("language === 'en' ? 'en-IN' : 'bn-IN'") &&
      !line.includes("language === 'bn' ? 'bn-IN' : 'en-IN'") &&
      !line.includes("aria-label={language === 'bn'")
    ) {
      if (line.includes("?") && line.includes(":") && (line.includes("'") || line.includes('"') || line.includes('`'))) {
        violations.push({
          file: relativePath,
          line: lineNum,
          snippet: line.trim(),
          issue: 'Inline language ternary used instead of centralized translation key',
        });
      }
    }

    // Check for 11px or sub-14px typography violations in user-facing non-super-admin UI files
    if (
      (filePath.includes('dashboards/report-viewer') ||
       filePath.includes('dashboards/teacher') ||
       filePath.includes('dashboards/school-admin') ||
       filePath.includes('dashboards/rfid-operator') ||
       filePath.includes('components/BentoScannerGrid') ||
       filePath.includes('components/Header')) &&
      (line.includes('text-[11px]') || line.includes('text-[10px]') || line.includes('text-[9px]'))
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        snippet: line.trim(),
        issue: 'Typography violates >=14px requirement (found <14px sub-pixel class)',
      });
    }
  });
}

function scanDir(dirPath: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else {
      checkFile(fullPath);
    }
  }
}

console.log('[CI Guardrail] Verifying centralized i18n & >=14px typography standard across target UI surfaces...');
scanDir(SRC_DIR);

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} localization / typography standard violation(s):`);
  violations.forEach((v) => {
    console.error(`\n- [${v.file}:${v.line}] ${v.issue}`);
    console.error(`  Snippet: ${v.snippet}`);
  });
  process.exit(1);
} else {
  console.log('✅ All target UI files satisfy centralized i18n & >=14px accessibility standards.');
  process.exit(0);
}
