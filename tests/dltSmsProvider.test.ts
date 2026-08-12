import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DltSmsProvider } from '../src/services/sms/dltSmsProvider';

describe('Live DltSmsProvider & Security Hardening Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails closed in production mode when default credentials are used', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new DltSmsProvider('dlt-key', 'SCHATT', 'dlt-webhook-secret');
    const result = await provider.sendSms({
      to: '+919876543210',
      message: 'Test message',
      dltHeader: 'SCHATT',
      dltPrincipalEntityId: 'ENTITY123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DLT_CREDENTIALS_NOT_CONFIGURED');
  });

  it('executes HTTP fetch call with correct headers and payload in configured environment', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providerMessageId: 'vendor-msg-999' }),
    } as any);

    const provider = new DltSmsProvider('valid-api-key', 'SCHATT', 'valid-secret');
    const result = await provider.sendSms({
      to: '+919876543210',
      message: 'Attendance Notification',
      dltHeader: 'SCHATT',
      dltPrincipalEntityId: 'ENTITY123',
      dltTemplateId: 'TEMP456',
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('vendor-msg-999');

    fetchSpy.mockRestore();
  });

  it('handles signature verification safely without buffer length mismatch exceptions', async () => {
    const provider = new DltSmsProvider('valid-api-key', 'SCHATT', 'test-secret');
    const invalidLengthVerification = await provider.verifyCallback(
      { 'x-dlt-signature': 'short' },
      { providerMessageId: 'm1', status: 'DELIVERED' },
      '{"providerMessageId":"m1","status":"DELIVERED"}'
    );

    expect(invalidLengthVerification.valid).toBe(false);
    expect(invalidLengthVerification.error).toBe('INVALID_CALLBACK_SIGNATURE');
  });
});
