import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SQL Placeholder Sequence Regression Test', () => {
  it('ensures all raw SQL query strings in the codebase use contiguous parameter placeholders', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const testsDir = path.join(process.cwd(), 'tests');

    function getAllTsFiles(dir: string): string[] {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getAllTsFiles(filePath));
        } else if (file.endsWith('.ts')) {
          results.push(filePath);
        }
      }
      return results;
    }

    const files = [...getAllTsFiles(srcDir), ...getAllTsFiles(testsDir)];
    const invalidQueries: { file: string; line: number; query: string }[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Find single-line query patterns with $2 but without $1
        if (line.includes('$2') && !line.includes('$1') && !line.includes('DUMMY_PASSWORD_HASH') && !line.includes('argon2id')) {
          invalidQueries.push({
            file: path.relative(process.cwd(), filePath),
            line: idx + 1,
            query: line.trim(),
          });
        }
      });
    }

    expect(invalidQueries).toHaveLength(0);
  });
});
