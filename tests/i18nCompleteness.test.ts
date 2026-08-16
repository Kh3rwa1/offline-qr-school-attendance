import { describe, it, expect } from 'vitest';
import { translations, translate } from '../src/i18n';

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

  it('should translate correctly via translate helper in both languages', () => {
    expect(translate('login', 'en')).toBe('Log In');
    expect(translate('login', 'bn')).toBe('লগ ইন করুন');
    expect(translate('navSchoolStaff', 'bn')).toBe('বিদ্যালয়ের কর্মী');
    expect(translate('navParentMessages', 'bn')).toBe('অভিভাবকের বার্তা');
  });
});
