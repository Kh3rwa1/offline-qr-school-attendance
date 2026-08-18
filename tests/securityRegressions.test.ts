import { describe, it, expect } from 'vitest';
import { sanitizeSpreadsheetValue } from '../src/services/excelExportService';
import { sanitizeSlug, isValidSlug } from '../src/services/schoolSlug';
import { getUserSafeError } from '../src/errors/userSafeErrors';

describe('Security & Negative Regression Suite', () => {
  // 1. Formula Injection & Spreadsheet Weaponization Defense
  describe('Formula Injection Defense (CSV & Report Exports)', () => {
    it('escapes leading dangerous spreadsheet formula triggers (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeSpreadsheetValue('=1+1')).toBe("'=1+1");
      expect(sanitizeSpreadsheetValue('+cmd|')).toBe("'+cmd|");
      expect(sanitizeSpreadsheetValue('-2+3')).toBe("'-2+3");
      expect(sanitizeSpreadsheetValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeSpreadsheetValue('\tDDE("cmd")')).toBe("'\tDDE(\"cmd\")");
      expect(sanitizeSpreadsheetValue('\r=1+1')).toBe("'\r=1+1");
    });

    it('leaves safe alphanumeric text, booleans, numbers, and standard dates un-escaped', () => {
      expect(sanitizeSpreadsheetValue('Rampur High School')).toBe('Rampur High School');
      expect(sanitizeSpreadsheetValue('2026-08-18')).toBe('2026-08-18');
      expect(sanitizeSpreadsheetValue('Class 9-A')).toBe('Class 9-A');
      expect(sanitizeSpreadsheetValue(123)).toBe(123);
      expect(sanitizeSpreadsheetValue(true)).toBe(true);
      expect(sanitizeSpreadsheetValue('')).toBe('');
      expect(sanitizeSpreadsheetValue(null)).toBe('');
      expect(sanitizeSpreadsheetValue(undefined)).toBe('');
    });
  });

  // 2. School Slug Parameter Pollution & Path Traversal Defense
  describe('School Slug Sanitization & Constraint Defense', () => {
    it('sanitizes malicious characters, path traversals, and unicode diacritics', () => {
      expect(sanitizeSlug('../../etc/passwd')).toBe('etc-passwd');
      expect(sanitizeSlug('<script>alert(1)</script>')).toBe('script-alert-1-script');
      expect(sanitizeSlug('Rampur  High   School!!')).toBe('rampur-high-school');
      expect(sanitizeSlug('স্কুল নাম')).toBe(''); // Non-latin fallback handled
    });

    it('strictly enforces regex constraint CHECK (slug ~ ^[a-z0-9]+(-[a-z0-9]+)*$)', () => {
      expect(isValidSlug('rampur-high-school')).toBe(true);
      expect(isValidSlug('school-01')).toBe(true);
      expect(isValidSlug('a')).toBe(false); // Too short
      expect(isValidSlug('-school')).toBe(false); // Leading dash
      expect(isValidSlug('school-')).toBe(false); // Trailing dash
      expect(isValidSlug('school--01')).toBe(false); // Consecutive dashes
      expect(isValidSlug('School-01')).toBe(false); // Uppercase rejected by strict slug regex
      expect(isValidSlug('school/01')).toBe(false); // Path traversal char
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug(null as any)).toBe(false);
    });
  });

  // 3. User Error Sanitization & Leakage Prevention
  describe('User Safe Error Sanitization', () => {
    it('prevents leaking internal stack traces and PostgreSQL error codes to end users', () => {
      const pgError = new Error('column "secret_token" does not exist at character 42 in SELECT * FROM credentials');
      const safeErrorEn = getUserSafeError(pgError, 'en');
      const safeErrorBn = getUserSafeError(pgError, 'bn');

      expect(safeErrorEn.message).not.toContain('secret_token');
      expect(safeErrorEn.message).not.toContain('SELECT * FROM');
      expect(safeErrorBn.message).not.toContain('secret_token');
    });
  });
});
