import { env } from '../../env';
import crypto from 'node:crypto';

const PREFIX = 'aerdr_'; // greppable in leaks; enables GitHub secret scanning custom patterns
const TOKEN_RE = /^aerdr_[A-Za-z0-9_-]{43}$/; // 32 bytes base64url = 43 chars

function pepper(): string {
  const p = env.READER_TOKEN_PEPPER;
  if (!p || p.length < 32) {
    if (env.NODE_ENV === 'production' && env.CI !== 'true') {
      throw new Error('READER_TOKEN_PEPPER (>= 32 chars) must be set in production');
    }
    return 'dev-only-reader-token-pepper-32-chars-min!!';
  }
  return p;
}

export function hashReaderToken(token: string): string {
  return crypto.createHmac('sha256', pepper()).update(token, 'utf8').digest('hex');
}

export function generateReaderToken(): { token: string; hash: string; hint: string } {
  const token = PREFIX + crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashReaderToken(token), hint: token.slice(-4) };
}

export function parseBearer(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = m?.[1];
  if (!token || !TOKEN_RE.test(token)) return null; // reject malformed early — cheap, no DB hit
  return token;
}
