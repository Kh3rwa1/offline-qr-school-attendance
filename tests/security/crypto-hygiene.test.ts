import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateReaderToken, hashReaderToken } from '../../src/services/rfid/readerTokens';

const KNOWN_DEFAULT_KEYS = [
  'FFFFFFFFFFFF', // MIFARE Classic transport/factory key
  'A0A1A2A3A4A5', // MIFARE Classic MAD key A
  'B0B1B2B3B4B5', // MIFARE Classic MAD key B
  'D3F7D3F7D3F7', // NXP NFC Forum sector key
  '00000000000000000000000000000000', // DESFire factory zero key (16-byte)
];

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Crypto Hygiene & Insecure Key Grep Auditing', () => {
  it('ensures no legacy default keys exist in active src/ codebase paths', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const sourceFiles = getAllSourceFiles(srcDir);

    expect(sourceFiles.length).toBeGreaterThan(10);

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8').toUpperCase();
      for (const defaultKey of KNOWN_DEFAULT_KEYS) {
        const found = content.includes(defaultKey.toUpperCase());
        expect(
          found,
          `Insecure default key ${defaultKey} found in ${path.relative(srcDir, file)}!`
        ).toBe(false);
      }
    }
  });

  it('generates reader bearer tokens with 256 bits of CSPRNG entropy and aerdr_ prefix', () => {
    const { token, hint, hash } = generateReaderToken();

    expect(token).toMatch(/^aerdr_[A-Za-z0-9_-]{43}$/);
    expect(hint).toHaveLength(4);
    expect(hash).toHaveLength(64); // HMAC-SHA-256 hex string

    // Assert that the hash is the deterministic HMAC-SHA-256 of the token
    expect(hashReaderToken(token)).toBe(hash);

    // Assert uniqueness across generation
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const t = generateReaderToken();
      expect(set.has(t.token)).toBe(false);
      set.add(t.token);
    }
    expect(set.size).toBe(50);
  });
});
