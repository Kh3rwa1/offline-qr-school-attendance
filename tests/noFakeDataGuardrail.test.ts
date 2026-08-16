import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('No Fake / Hardcoded Operational Data Guardrail', () => {
  const scanDirs = [
    path.resolve(__dirname, '../src/dashboards'),
    path.resolve(__dirname, '../src/layouts'),
  ];

  const forbiddenStrings = [
    '963 / 1,005',
    '95.8%',
    'Weekly Attendance Trend',
    'Telecom ACK Received',
    'Format 1.4 Schema',
    '924 / 1005',
    '1005',
  ];

  function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (!fullPath.includes('super-admin')) {
          getAllFiles(fullPath, arrayOfFiles);
        }
      } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !fullPath.includes('super-admin')) {
        arrayOfFiles.push(fullPath);
      }
    });
    return arrayOfFiles;
  }

  it('should not contain any fake or hardcoded weekly mock statistics in dashboards', () => {
    let allFiles: string[] = [];
    scanDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        allFiles = getAllFiles(dir, allFiles);
      }
    });

    const violations: { file: string; forbidden: string }[] = [];

    allFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      forbiddenStrings.forEach((forbidden) => {
        if (content.includes(forbidden)) {
          violations.push({ file: path.basename(file), forbidden });
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
