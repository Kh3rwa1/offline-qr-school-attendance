export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode = 'NOT_FOUND', details?: any) {
    super(message, 404, errorCode, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', errorCode = 'UNAUTHORIZED', details?: any) {
    super(message, 401, errorCode, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', errorCode = 'FORBIDDEN', details?: any) {
    super(message, 403, errorCode, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR', details?: any) {
    super(message, 400, errorCode, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'CONFLICT', details?: any) {
    super(message, 409, errorCode, details);
  }
}
