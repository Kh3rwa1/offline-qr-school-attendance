/**
 * Production Deterministic Cursor Pagination Utility
 * AttendEase OS
 */

export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number | string | null;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface DecodedCursor {
  id: string;
  timestamp?: string; // ISO string
  value?: string | number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/**
 * Encodes cursor payload to URL-safe base64 string
 */
export function encodeCursor(payload: DecodedCursor): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decodes URL-safe base64 cursor string
 * Throws an error if invalid or malformed
 */
export function decodeCursor(cursorStr?: string | null): DecodedCursor | null {
  if (!cursorStr || typeof cursorStr !== 'string' || !cursorStr.trim()) {
    return null;
  }
  try {
    const raw = Buffer.from(cursorStr.trim(), 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
      throw new Error('INVALID_CURSOR_STRUCTURE');
    }
    return parsed as DecodedCursor;
  } catch {
    throw new Error('INVALID_PAGINATION_CURSOR');
  }
}

/**
 * Sanitizes page size limit with safe server-side bounds
 */
export function parseLimit(
  limitInput?: number | string | null,
  defaultLimit = 50,
  maxLimit = 200
): number {
  if (limitInput === undefined || limitInput === null || limitInput === '') {
    return defaultLimit;
  }
  const parsed = Number(limitInput);
  if (isNaN(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  return Math.min(Math.floor(parsed), maxLimit);
}
