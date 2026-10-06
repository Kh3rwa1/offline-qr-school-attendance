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
  verifyCallback(headers: Record<string, unknown>, body: unknown, rawBody?: string | Buffer): Promise<CallbackVerificationResult>;

  /**
   * Parses callback payload into normalized delivery status payload.
   */
  parseCallback(body: unknown): Promise<ParsedCallbackPayload>;
}
