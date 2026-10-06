import { describe, it, expect } from 'vitest';

describe('Forbidden Strings Guardrail Rules (Step A2 & A3)', () => {
  // Test the regexes defined in scripts/verify-no-forbidden-strings.ts
  const sentinelUuidPattern = /00000000-0000-0000-0000-00000000000[0-9]/;
  const ciEnvPattern = /\benv\.CI\b|process\.env\.CI\b/;

  it('flags sentinel UUIDs that corrupt the audit trail', () => {
    expect(sentinelUuidPattern.test("const actorId = '00000000-0000-0000-0000-000000000001';")).toBe(true);
    expect(sentinelUuidPattern.test("const actorId = '00000000-0000-0000-0000-000000000000';")).toBe(true);
    expect(sentinelUuidPattern.test("const actorId = '00000000-0000-0000-0000-000000000009';")).toBe(true);
    // Real UUID should pass
    expect(sentinelUuidPattern.test("const realId = '123e4567-e89b-12d3-a456-426614174000';")).toBe(false);
  });

  it('flags env.CI and process.env.CI dependencies in app code', () => {
    expect(ciEnvPattern.test("if (env.CI === 'true') {")).toBe(true);
    expect(ciEnvPattern.test("if (process.env.CI) {")).toBe(true);
    expect(ciEnvPattern.test("const isCi = env.CI !== undefined;")).toBe(true);
    // Normal variables should pass
    expect(ciEnvPattern.test("const ciSecret = env.SESSION_SECRET;")).toBe(false);
  });
});
