import { describe, it, expect } from 'vitest';
import { translations, translate } from '../src/i18n';
import * as fs from 'fs';
import * as path from 'path';

describe('i18n Translation Completeness & Key Parity', () => {
  it('should have 100% key parity between English and Bengali dictionaries', () => {
    const enKeys = Object.keys(translations.en).sort();
    const bnKeys = Object.keys(translations.bn).sort();

    expect(enKeys).toEqual(bnKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(100);
  });

  it('should not contain empty or untranslated strings in Bengali dictionary', () => {
    Object.entries(translations.bn).forEach(([key, value]) => {
      expect(value, `Key "${key}" should have non-empty Bengali translation`).toBeTruthy();
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThan(0);
    });
  });

  it('should translate correctly via translate helper in both languages using Bengalish standards', () => {
    expect(translate('login', 'en')).toBe('Log In');
    expect(translate('login', 'bn')).toBe('Login করুন');
    expect(translate('navSchoolStaff', 'bn')).toBe('School Staff');
    expect(translate('navParentMessages', 'bn')).toBe('Parent Messages');
    expect(translate('internetConnected', 'bn')).toBe('ইন্টারনেট Connected');
    expect(translate('sendRecordsNow', 'bn')).toBe('Saved Records Send করুন');
  });

  it('should enforce zero hardcoded inline i18n ternaries in critical dashboard files', () => {
    const criticalFiles = [
      '../src/components/Header.tsx',
      '../src/components/BentoScannerGrid.tsx',
      '../src/layouts/TopBar.tsx',
      '../src/app/LoginPage.tsx',
      '../src/dashboards/report-viewer/ReportViewerDashboard.tsx',
      '../src/dashboards/report-viewer/DailyReports.tsx',
      '../src/dashboards/report-viewer/ExportCenter.tsx',
      '../src/dashboards/report-viewer/TrendReports.tsx',
      '../src/dashboards/teacher/TeacherDashboard.tsx',
      '../src/dashboards/teacher/OfflineWorkspace.tsx',
      '../src/dashboards/teacher/AssignedClasses.tsx',
    ];

    criticalFiles.forEach((relPath) => {
      const fullPath = path.resolve(__dirname, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (
          (line.includes("language === 'bn'") || line.includes("lang === 'bn'")) &&
          !line.includes('nameBn') &&
          !line.includes('bg-') &&
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
          if (line.includes('?') && line.includes(':') && (line.includes("'") || line.includes('"'))) {
            throw new Error(`Forbidden inline i18n ternary in ${relPath}:${lineNum} -> "${line.trim()}"`);
          }
        }
      });
    });
  });
});
