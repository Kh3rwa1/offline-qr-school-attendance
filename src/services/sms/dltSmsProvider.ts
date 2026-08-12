import crypto from 'node:crypto';
import { CallbackVerificationResult, ParsedCallbackPayload, SmsProvider, SmsSendParams, SmsSendResult } from './smsProvider';
import { redactPhoneNumber } from './smsUtils';

/**
 * Production Indian DLT-compliant SMS Gateway Provider Adapter (e.g. Jio DLT / MSG91 / Textlocal DLT format)
 */
export class DltSmsProvider implements SmsProvider {
  readonly name = 'dlt';

  constructor(
    private apiKey = process.env.DLT_SMS_API_KEY || 'dlt-key',
    private senderHeader = process.env.DLT_SMS_HEADER || 'SCHATT',
    private webhookSecret = process.env.DLT_WEBHOOK_SECRET || 'dlt-webhook-secret'
  ) {}

  async sendSms(params: SmsSendParams): Promise<SmsSendResult> {
    // Fail closed in production mode if credentials are defaults
    if (process.env.NODE_ENV === 'production' && (this.apiKey === 'dlt-key' || this.webhookSecret === 'dlt-webhook-secret')) {
      console.error('[DltSmsProvider] Unconfigured placeholder credentials in production mode!');
      return {
        success: false,
        error: 'DLT_CREDENTIALS_NOT_CONFIGURED',
        isPermanentFailure: true,
      };
    }

    if (!params.to || !params.message) {
      return {
        success: false,
        error: 'INVALID_SMS_PARAMS',
        isPermanentFailure: true,
      };
    }

    const cleanPhone = params.to.replace(/\s+/g, '');
    if (!/^\+91[6-9]\d{9}$/.test(cleanPhone)) {
      return {
        success: false,
        error: 'INVALID_INDIAN_PHONE_NUMBER',
        isPermanentFailure: true,
      };
    }

    const dltHeader = params.dltHeader || this.senderHeader;
    const dltPrincipalEntityId = params.dltPrincipalEntityId || process.env.DLT_PRINCIPAL_ENTITY_ID;

    if (!dltPrincipalEntityId || !dltHeader) {
      return {
        success: false,
        error: 'MISSING_REQUIRED_DLT_HEADERS',
        isPermanentFailure: true,
      };
    }

    const idempotencyKey = params.jobId || Math.random().toString(36).substring(2, 10);
    console.log(`[DltSmsProvider] Submitting SMS to ${redactPhoneNumber(cleanPhone)} | Header: ${dltHeader} | EntityID: ${dltPrincipalEntityId} | IdempotencyKey: ${idempotencyKey}`);

    const gatewayUrl = process.env.DLT_SMS_GATEWAY_URL || 'https://api.dlt-sms-gateway.com/v1/send';

    try {
      const resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DLT-Header': dltHeader,
          'X-DLT-Entity-ID': dltPrincipalEntityId,
        },
        body: JSON.stringify({
          to: cleanPhone,
          message: params.message,
          dltTemplateId: params.dltTemplateId,
          idempotencyKey,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return {
          success: false,
          error: `GATEWAY_HTTP_${resp.status}: ${errText.slice(0, 100)}`,
          isPermanentFailure: resp.status >= 400 && resp.status < 500,
        };
      }

      const resData = (await resp.json().catch(() => ({}))) as any;
      const providerMessageId = resData.providerMessageId || `dlt-${idempotencyKey}-${Date.now()}`;

      return {
        success: true,
        providerMessageId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `GATEWAY_NETWORK_ERROR: ${err.message}`,
        isPermanentFailure: false,
      };
    }
  }

  async verifyCallback(headers: Record<string, any>, body: any, rawBody?: string | Buffer): Promise<CallbackVerificationResult> {
    const signature = headers['x-dlt-signature'] || headers['X-Dlt-Signature'];
    if (!signature) {
      return { valid: false, error: 'MISSING_SIGNATURE_HEADER' };
    }

    const payloadToSign = rawBody
      ? (typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'))
      : (typeof body === 'string' ? body : JSON.stringify(body));

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadToSign)
      .digest('hex');

    const sigBuf = Buffer.from(String(signature));
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'INVALID_CALLBACK_SIGNATURE' };
    }

    return { valid: true };
  }

  async parseCallback(body: any): Promise<ParsedCallbackPayload> {
    if (!body || !body.providerMessageId || !body.status) {
      throw new Error('MALFORMED_CALLBACK_BODY');
    }

    let status: 'DELIVERED' | 'FAILED' | 'SENT' = 'SENT';
    if (body.status === 'DELIVERED' || body.status === 'DELIVRD') status = 'DELIVERED';
    else if (body.status === 'FAILED' || body.status === 'UNDELIV') status = 'FAILED';

    return {
      providerMessageId: body.providerMessageId,
      status,
      failureReason: body.failureReason || null,
      deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
    };
  }
}
