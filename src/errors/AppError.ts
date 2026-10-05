export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly publicMessage: string;
  readonly internal?: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    publicMessage: string,
    opts: { internal?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(`${code}: ${publicMessage}`, { cause: opts.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.internal = opts.internal;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get statusCode(): number {
    return this.status;
  }
  get errorCode(): string {
    return this.code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode = 'NOT_FOUND', details?: any) {
    super(errorCode, 404, message, { internal: details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', errorCode = 'UNAUTHORIZED', details?: any) {
    super(errorCode, 401, message, { internal: details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', errorCode = 'FORBIDDEN', details?: any) {
    super(errorCode, 403, message, { internal: details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR', details?: any) {
    super(errorCode, 400, message, { internal: details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'CONFLICT', details?: any) {
    super(errorCode, 409, message, { internal: details });
  }
}

// One generic message for EVERY reader-auth failure: unknown reader, wrong school,
// bad signature, bad token. Attackers must not be able to tell them apart.
export const readerAuthFailed = (internal: Record<string, unknown>) =>
  new AppError('UNAUTHORIZED_READER', 401, 'Reader authentication failed', { internal });

/** Transitional: maps legacy `throw new Error('PREFIX: ...')` to AppError. Delete in Phase 3. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const legacy: Array<[string, () => AppError]> = [
    ['UNAUTHORIZED_READER', () => readerAuthFailed({ legacyMessage: msg })],
    ['FORBIDDEN_READER', () => new AppError('FORBIDDEN_READER', 403, 'Reader is not permitted', { internal: { legacyMessage: msg } })],
    ['MALFORMED_PAYLOAD', () => new AppError('MALFORMED_PAYLOAD', 400, 'Malformed payload', { internal: { legacyMessage: msg } })],
    ['PAYLOAD_TOO_LARGE', () => new AppError('PAYLOAD_TOO_LARGE', 413, 'Payload too large')],
    ['BATCH_TOO_LARGE', () => new AppError('BATCH_TOO_LARGE', 413, 'Too many reads in one batch')],
    ['OVERSIZED_BATCH', () => new AppError('BATCH_TOO_LARGE', 413, 'Too many reads in one batch')],
    ['CONFIG_ERROR', () => new AppError('READER_NOT_CONFIGURED', 503, 'Reader integration unavailable', { internal: { legacyMessage: msg } })],
    ['MALFORMED_BODY', () => new AppError('MALFORMED_BODY', 400, 'Malformed body', { internal: { legacyMessage: msg } })],
    ['MISSING_SCHOOL_ID', () => new AppError('MISSING_SCHOOL_ID', 400, 'School must be specified in the URL path')],
    ['SCHOOL_ID_MISMATCH', () => new AppError('SCHOOL_ID_MISMATCH', 400, 'Conflicting school identifiers in request')],
  ];
  for (const [prefix, make] of legacy) {
    if (msg.startsWith(prefix)) return make();
  }
  return new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred', { cause: err });
}
