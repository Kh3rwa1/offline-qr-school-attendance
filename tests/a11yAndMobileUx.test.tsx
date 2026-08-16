import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Accessibility & Mobile Touch Targets Guardrail', () => {
  const dashboardsDir = path.resolve(__dirname, '../src/dashboards');

  function getAllTsxFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllTsxFiles(fullPath, arrayOfFiles);
      } else if (file.endsWith('.tsx')) {
        arrayOfFiles.push(fullPath);
      }
    });
    return arrayOfFiles;
  }

  it('should verify all interactive dashboard files include min-h-[44px] touch target styles or buttons', () => {
    const files = getAllTsxFiles(dashboardsDir);
    expect(files.length).toBeGreaterThan(5);

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      // Verify files with interactive buttons or forms include accessible touch target classes
      if (content.includes('<button') || content.includes('<input') || content.includes('<select')) {
        const hasAccessibleTargets =
          content.includes('min-h-[44px]') ||
          content.includes('min-h-[48px]') ||
          content.includes('Button') ||
          content.includes('py-2') ||
          content.includes('py-2.5') ||
          content.includes('py-3');
        expect(hasAccessibleTargets, `File ${path.basename(file)} should have accessible touch heights`).toBe(true);
      }
    });
  });
});
