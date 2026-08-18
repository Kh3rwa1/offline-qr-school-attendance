import { describe, it, expect } from 'vitest';
import { LANDING_COPY, ONBOARDING_STAGES, LocalizedText } from '../src/app/landingCopy';
import * as fs from 'fs';
import * as path from 'path';

describe('Landing Page Localization Completeness (EN / BN / HI)', () => {
  it('should have complete non-empty strings across EN, BN, and HI for all LANDING_COPY entries', () => {
    Object.entries(LANDING_COPY).forEach(([key, val]) => {
      const entry = val as LocalizedText;
      expect(entry.en, `Key "${key}" missing English text`).toBeTruthy();
      expect(entry.bn, `Key "${key}" missing Bengali text`).toBeTruthy();
      expect(entry.hi, `Key "${key}" missing Hindi text`).toBeTruthy();

      expect(entry.en.trim().length, `Key "${key}" English is empty`).toBeGreaterThan(0);
      expect(entry.bn.trim().length, `Key "${key}" Bengali is empty`).toBeGreaterThan(0);
      expect(entry.hi.trim().length, `Key "${key}" Hindi is empty`).toBeGreaterThan(0);
    });
  });

  it('should have complete non-empty localized strings across all 8 ONBOARDING_STAGES', () => {
    expect(ONBOARDING_STAGES.length).toBe(8);

    ONBOARDING_STAGES.forEach((stage) => {
      expect(stage.name.en).toBeTruthy();
      expect(stage.name.bn).toBeTruthy();
      expect(stage.name.hi).toBeTruthy();

      expect(stage.title.en).toBeTruthy();
      expect(stage.title.bn).toBeTruthy();
      expect(stage.title.hi).toBeTruthy();

      expect(stage.subtitle.en).toBeTruthy();
      expect(stage.subtitle.bn).toBeTruthy();
      expect(stage.subtitle.hi).toBeTruthy();

      expect(stage.deliverable.en).toBeTruthy();
      expect(stage.deliverable.bn).toBeTruthy();
      expect(stage.deliverable.hi).toBeTruthy();
    });
  });

  it('proves LandingPage.tsx does not leak un-localized hardcoded marketing assertions or ternaries', () => {
    const landingPath = path.resolve(__dirname, '../src/app/LandingPage.tsx');
    const content = fs.readFileSync(landingPath, 'utf-8');

    // Prohibited marketing phrases that should not appear hardcoded
    const forbiddenPhrases = [
      'UDISE+ compliant',
      'Government-ready',
      'Govt standard',
      'Protected under India’s DPDP law',
      'Roll call used to take 20 minutes',
      'Ranjit Kumar Das',
      'Sunita Mahato',
      'Khatra High School',
      'Purulia Zilla School',
    ];

    for (const phrase of forbiddenPhrases) {
      expect(content).not.toContain(phrase);
    }
  });
});
