import { DatabaseError } from 'pg';

function getDbError(err: unknown): DatabaseError | null {
  if (err instanceof DatabaseError) return err;
  if (typeof err === 'object' && err !== null && 'cause' in err && (err as { cause: unknown }).cause instanceof DatabaseError) {
    return (err as { cause: DatabaseError }).cause;
  }
  return null;
}

export const isUniqueViolation = (err: unknown, constraint?: string): boolean => {
  const dbErr = getDbError(err);
  if (!dbErr) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      return !constraint || (err as { constraint?: string }).constraint === constraint;
    }
    return false;
  }
  return dbErr.code === '23505' && (!constraint || dbErr.constraint === constraint);
};

export const isFkViolation = (err: unknown): boolean => {
  const dbErr = getDbError(err);
  if (!dbErr) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23503') {
      return true;
    }
    return false;
  }
  return dbErr.code === '23503';
};
