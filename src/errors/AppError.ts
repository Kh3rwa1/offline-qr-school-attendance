export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly publicMessage: string;
  readonly internal?: Record<string, unknown>;
  readonly details?: Array<{ path: string; code: string }>;

  constructor(
    code: string,
    status: number,
    publicMessage: string,
    opts: {
      internal?: Record<string, unknown>;
      cause?: unknown;
      details?: Array<{ path: string; code: string }>;
    } = {}
  ) {
    super(`${code}: ${publicMessage}`, { cause: opts.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.internal = opts.internal;
    this.details = opts.details;
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

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { status?: number; statusCode?: number }).status ||
      (err as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      const code = (err as { code?: string }).code || 'ERROR';
      const msg = (err as { message?: string }).message || 'An error occurred';
      return new AppError(code, status, msg, { cause: err });
    }
  }
  return new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred', { cause: err });
}
