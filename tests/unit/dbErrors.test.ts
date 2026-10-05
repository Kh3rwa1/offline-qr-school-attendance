import { describe, it, expect } from 'vitest';
import { DatabaseError } from 'pg';
import { isUniqueViolation, isFkViolation } from '../../src/db/errors';
import { AppError, toAppError } from '../../src/errors/AppError';

describe('Database Error Mappers', () => {
  it('detects unique violations from DatabaseError instance', () => {
    const err = new DatabaseError('duplicate key value', 10, 'error');
    err.code = '23505';
    err.constraint = 'students_school_roll_uq';

    expect(isUniqueViolation(err)).toBe(true);
    expect(isUniqueViolation(err, 'students_school_roll_uq')).toBe(true);
    expect(isUniqueViolation(err, 'different_constraint')).toBe(false);
  });

  it('detects wrapped cause unique violations', () => {
    const inner = new DatabaseError('duplicate key value', 10, 'error');
    inner.code = '23505';
    inner.constraint = 'students_school_roll_uq';
    const wrapped = new Error('Drizzle wrapper', { cause: inner });

    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped, 'students_school_roll_uq')).toBe(true);
    expect(isUniqueViolation(wrapped, 'other_uq')).toBe(false);
  });

  it('detects foreign key violations', () => {
    const err = new DatabaseError('insert or update violates fk', 10, 'error');
    err.code = '23503';

    expect(isFkViolation(err)).toBe(true);

    const wrapped = new Error('Drizzle wrapper', { cause: err });
    expect(isFkViolation(wrapped)).toBe(true);

    expect(isFkViolation(new Error('general error'))).toBe(false);
  });

  it('returns false for non-db errors', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('something else'))).toBe(false);
    expect(isFkViolation(null)).toBe(false);
  });
});

describe('toAppError mapper', () => {
  it('passes through existing AppError', () => {
    const original = new AppError('TEST_CODE', 400, 'Test message');
    expect(toAppError(original)).toBe(original);
  });

  it('maps status code objects', () => {
    const err = { status: 404, code: 'NOT_FOUND', message: 'Item missing' };
    const mapped = toAppError(err);
    expect(mapped.status).toBe(404);
    expect(mapped.code).toBe('NOT_FOUND');
    expect(mapped.publicMessage).toBe('Item missing');
  });

  it('wraps unknown errors as INTERNAL_ERROR 500', () => {
    const mapped = toAppError(new Error('something blew up'));
    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe('INTERNAL_ERROR');
  });
});
