import fs from 'fs';
import path from 'path';

const FORBIDDEN_PATTERNS = [
  { pattern: /default-school/i, label: 'Hardcoded default-school tenant ID' },
  { pattern: /'teacherId':\s*'teacher'/i, label: 'Fabricated teacherId fallback' },
  { pattern: /teacherId:\s*'teacher'/i, label: 'Fabricated teacherId fallback' },
  { pattern: /actorId:\s*'teacher'/i, label: 'Fabricated actorId fallback' },
  { pattern: /'04:A2:8B:1A:99:40'/, label: 'Fabricated RFID test card UID' },
  { pattern: /\balert\s*\(/, label: 'Prohibited browser alert() popup' },
];

const SCAN_DIR = path.resolve(process.cwd(), 'src');

function scanFile(filePath: string): Array<{ line: number; label: string; text: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; label: string; text: string }> = [];

  lines.forEach((line, idx) => {
    // Ignore comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    for (const item of FORBIDDEN_PATTERNS) {
      if (item.pattern.test(line)) {
        violations.push({
          line: idx + 1,
          label: item.label,
          text: trimmed,
        });
      }
    }
  });

  return violations;
}

function traverseDirectory(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(traverseDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

console.log(`[CI Guardrail] Scanning ${SCAN_DIR} for prohibited mock strings & anti-patterns...`);
const allFiles = traverseDirectory(SCAN_DIR);
let totalViolations = 0;

for (const file of allFiles) {
  const violations = scanFile(file);
  if (violations.length > 0) {
    console.error(`\n❌ Prohibited pattern found in ${path.relative(process.cwd(), file)}:`);
    for (const v of violations) {
      console.error(`   Line ${v.line}: [${v.label}] -> ${v.text}`);
      totalViolations++;
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n🚨 Guardrail Check Failed: Found ${totalViolations} forbidden string violation(s).`);
  process.exit(1);
} else {
  console.log(`✅ Guardrail Check Passed: 0 forbidden strings found across ${allFiles.length} source files.`);
}
