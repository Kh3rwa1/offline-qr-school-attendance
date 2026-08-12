import { redactPhoneNumber } from './smsUtils';

/**
 * Parameters passed to SmsProvider.sendSms
 */
export interface SmsSendParams {
  to: string;
  message: string;
  dltPrincipalEntityId?: string;
  dltHeader?: string;
  dltTemplateId?: string;
  jobId?: string;
}

/**
 * Response returned from SmsProvider.sendSms
 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  isPermanentFailure?: boolean;
}

/**
 * Result of callback signature/auth verification
 */
export interface CallbackVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Parsed payload from SMS delivery callback
 */
export interface ParsedCallbackPayload {
  providerMessageId: string;
  status: 'DELIVERED' | 'FAILED' | 'SENT';
  failureReason?: string;
  deliveredAt?: Date;
}

/**
 * Provider-neutral SmsProvider interface.
 * All SMS provider implementations (Fake, Console, DLT/Gateway adapters)
 * must conform to this contract.
 */
export interface SmsProvider {
  readonly name: string;

  /**
   * Sends an SMS message via the provider.
   */
  sendSms(params: SmsSendParams): Promise<SmsSendResult>;

  /**
   * Verifies authenticity/signature of incoming delivery callback.
   */
  verifyCallback(headers: Record<string, any>, body: any): Promise<CallbackVerificationResult>;

  /**
   * Parses callback payload into normalized delivery status payload.
   */
  parseCallback(body: any): Promise<ParsedCallbackPayload>;
}

// ==========================================
// 1. Fake Deterministic Test Provider
// ==========================================
export class FakeSmsProvider implements SmsProvider {
  readonly name = 'fake';
  private sentMessages: Array<{
    to: string;
    message: string;
    params: SmsSendParams;
    providerMessageId: string;
    timestamp: Date;
  }> = [];

  private callbackSecretToken = 'fake-secret-token';
  private customFailRule: ((params: SmsSendParams) => { fail: boolean; isPermanent?: boolean; reason?: string } | null) | null = null;

  setCallbackSecretToken(token: string) {
    this.callbackSecretToken = token;
  }

  setCustomFailRule(rule: ((params: SmsSendParams) => { fail: boolean; isPermanent?: boolean; reason?: string } | null) | null) {
    this.customFailRule = rule;
  }

  async sendSms(params: SmsSendParams): Promise<SmsSendResult> {
    if (this.customFailRule) {
      const customRes = this.customFailRule(params);
      if (customRes?.fail) {
        return {
          success: false,
          error: customRes.reason || 'CUSTOM_SIMULATED_FAILURE',
          isPermanentFailure: customRes.isPermanent ?? false,
        };
      }
    }

    const cleanTo = params.to.replace(/\s+/g, '');

    // Deterministic Failure Rules for testing
    if (cleanTo.endsWith('999') || cleanTo.includes('INVALID') || cleanTo === '+910000000000') {
      return {
        success: false,
        error: 'PERMANENT_INVALID_PHONE_NUMBER',
        isPermanentFailure: true,
      };
    }

    if (cleanTo.endsWith('888')) {
      return {
        success: false,
        error: 'TRANSIENT_GATEWAY_TIMEOUT',
        isPermanentFailure: false,
      };
    }

    const providerMessageId = `fake-msg-${params.jobId || Math.random().toString(36).substring(2, 10)}`;
    this.sentMessages.push({
      to: params.to,
      message: params.message,
      params,
      providerMessageId,
      timestamp: new Date(),
    });

    return {
      success: true,
      providerMessageId,
    };
  }

  async verifyCallback(headers: Record<string, any>, body: any): Promise<CallbackVerificationResult> {
    const authHeader = headers['x-callback-auth-token'] || headers['X-Callback-Auth-Token'] || body?.authToken;
    if (authHeader !== this.callbackSecretToken) {
      return { valid: false, error: 'INVALID_CALLBACK_AUTH' };
    }
    return { valid: true };
  }

  async parseCallback(body: any): Promise<ParsedCallbackPayload> {
    if (!body || !body.providerMessageId) {
      throw new Error('MALFORMED_CALLBACK_BODY');
    }
    return {
      providerMessageId: body.providerMessageId,
      status: body.status || 'DELIVERED',
      failureReason: body.failureReason || null,
      deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
    };
  }

  getSentMessages() {
    return this.sentMessages;
  }

  clearSentMessages() {
    this.sentMessages = [];
    this.customFailRule = null;
  }
}

// ==========================================
// 2. Development Console Provider
// ==========================================
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private secretToken = 'console-secret-token';

  async sendSms(params: SmsSendParams): Promise<SmsSendResult> {
    const redacted = redactPhoneNumber(params.to);
    console.log(`[ConsoleSmsProvider] To: ${redacted} | Message: "${params.message}" | DLT Header: ${params.dltHeader || 'N/A'}`);
    
    return {
      success: true,
      providerMessageId: `console-msg-${params.jobId || Date.now()}`,
    };
  }

  async verifyCallback(headers: Record<string, any>, body: any): Promise<CallbackVerificationResult> {
    const authHeader = headers['x-callback-auth-token'] || body?.authToken;
    if (authHeader !== this.secretToken) {
      return { valid: false, error: 'INVALID_CALLBACK_AUTH' };
    }
    return { valid: true };
  }

  async parseCallback(body: any): Promise<ParsedCallbackPayload> {
    if (!body || !body.providerMessageId) {
      throw new Error('MALFORMED_CALLBACK_BODY');
    }
    return {
      providerMessageId: body.providerMessageId,
      status: body.status || 'DELIVERED',
      failureReason: body.failureReason,
      deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
    };
  }
}

// ==========================================
// 3. Provider Registry & Factory
// ==========================================
const providerRegistry = new Map<string, SmsProvider>();

// Register default providers
const fakeProvider = new FakeSmsProvider();
const consoleProvider = new ConsoleSmsProvider();

providerRegistry.set('fake', fakeProvider);
providerRegistry.set('console', consoleProvider);

export function getSmsProvider(providerName?: string): SmsProvider {
  const configured = providerName || process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'production' ? undefined : 'fake');
  if (!configured) throw new Error('SMS_PROVIDER_REQUIRED');
  const name = configured.toLowerCase();
  if (process.env.NODE_ENV === 'production' && (name === 'fake' || name === 'console') && process.env.ALLOW_FAKE_SMS_IN_PRODUCTION !== 'true') {
    throw new Error('PRODUCTION_SMS_PROVIDER_FORBIDDEN');
  }
  const provider = providerRegistry.get(name);
  if (!provider) {
    throw new Error(`UNKNOWN_SMS_PROVIDER: ${name}`);
  }
  return provider;
}

export function registerSmsProvider(provider: SmsProvider) {
  providerRegistry.set(provider.name.toLowerCase(), provider);
}

export function getFakeSmsProvider(): FakeSmsProvider {
  return fakeProvider;
}

/**
 * ADAPTER CONTRACT DOCUMENTATION FOR PRODUCTION DLT SMS INTEGRATION:
 * -----------------------------------------------------------------
 * To integrate a production SMS / DLT gateway (e.g. Textlocal, Jio DLT, MSG91, Twilio),
 * implement the `SmsProvider` interface:
 *
 * 1. `sendSms(params: SmsSendParams)`:
 *    - Format payload according to vendor API guidelines.
 *    - Pass DLT parameters: `dltPrincipalEntityId` (Entity ID), `dltHeader` (Sender ID/Header), `dltTemplateId`.
 *    - Return `SmsSendResult`: { success: boolean, providerMessageId: string, isPermanentFailure: boolean, error: string }.
 *
 * 2. `verifyCallback(headers, body)`:
 *    - Validate incoming signature or auth token (e.g., HMAC-SHA256 signature verification).
 *
 * 3. `parseCallback(body)`:
 *    - Map vendor-specific status codes (e.g. "0" / "DELIVRD") to 'DELIVERED', 'FAILED', or 'SENT'.
 *
 * 4. Register using `registerSmsProvider(new ProductionDltProvider())`.
 */
