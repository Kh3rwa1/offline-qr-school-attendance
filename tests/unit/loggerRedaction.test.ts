import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { loggerOptions } from '../../src/lib/logger';

describe('Logger Redaction', () => {
  it('never logs bearer tokens or raw EPCs', async () => {
    const lines: string[] = [];
    const testLogger = pino(
      { ...loggerOptions, transport: undefined },
      { write: (l: string) => lines.push(l) }
    );

    testLogger.info({
      req: {
        headers: {
          authorization: 'Bearer aerdr_secret',
          cookie: 'session=secret_session_token_123',
          'x-csrf-token': 'csrf_token_secret_xyz',
          'x-reader-signature': 'sig_super_secret_reader',
          'x-zebra-signature': 'sig_super_secret_zebra',
        },
      },
      read: {
        epc: 'E28011601234567890abcdef',
        idHex: '0102030405060708',
        tid: 'E200341201234567',
        tidHex: 'E200341201234567',
      },
      user: {
        password: 'PlaintextPassword123!',
        passwordHash: '$2b$12$securehashstringhere',
        token: 'access_token_super_secret',
        secret: 'system_master_secret',
        readerSecret: 'zebra_reader_hmac_secret',
        phone: '+919876543210',
        guardianPhone: '+919123456789',
        contactNumber: '+919988776655',
      },
      internal: {
        readerIdentifier: 'reader_physical_hw_id',
      },
    });

    const out = lines.join('');

    // Ensure raw secrets and PII never appear in log output
    expect(out).not.toContain('aerdr_secret');
    expect(out).not.toContain('secret_session_token_123');
    expect(out).not.toContain('csrf_token_secret_xyz');
    expect(out).not.toContain('sig_super_secret_reader');
    expect(out).not.toContain('sig_super_secret_zebra');
    expect(out).not.toContain('E28011601234567890abcdef');
    expect(out).not.toContain('0102030405060708');
    expect(out).not.toContain('E200341201234567');
    expect(out).not.toContain('PlaintextPassword123!');
    expect(out).not.toContain('$2b$12$securehashstringhere');
    expect(out).not.toContain('access_token_super_secret');
    expect(out).not.toContain('system_master_secret');
    expect(out).not.toContain('zebra_reader_hmac_secret');
    expect(out).not.toContain('+919876543210');
    expect(out).not.toContain('+919123456789');
    expect(out).not.toContain('+919988776655');
    expect(out).not.toContain('reader_physical_hw_id');

    // Ensure they were redacted with censor
    expect(out).toContain('[REDACTED]');
  });
});
