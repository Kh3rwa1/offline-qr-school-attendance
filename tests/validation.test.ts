import { describe, it, expect, vi } from 'vitest';
import { validateRequest, commonSchemas } from '../src/middleware/validate';
import { z } from 'zod';

function createMockReqRes(params: any = {}, body: any = {}, query: any = {}) {
  const req: any = { params, body, query };
  let statusCode = 200;
  let jsonResponse: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonResponse = data;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get responseData() {
      return jsonResponse;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('Phase 2 — Strict Runtime Input Validation Tests', () => {
  const dummySchema = z.object({
    id: commonSchemas.uuid,
    date: commonSchemas.isoDate,
    timestamp: commonSchemas.isoTimestamp,
    status: commonSchemas.attendanceStatus,
    source: commonSchemas.scanSource,
  });

  const middleware = validateRequest({
    params: z.object({ id: commonSchemas.uuid }),
    body: dummySchema,
  });

  it('accepts valid payload matching schema', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const { req, res, next } = createMockReqRes(
      { id: validUuid },
      {
        id: validUuid,
        date: '2026-08-15',
        timestamp: new Date().toISOString(),
        status: 'PRESENT',
        source: 'CAMERA',
      }
    );

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('rejects malformed UUID in params with 400 Bad Request', async () => {
    const { req, res, next } = createMockReqRes(
      { id: 'not-a-valid-uuid' },
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2026-08-15',
        timestamp: new Date().toISOString(),
        status: 'PRESENT',
        source: 'CAMERA',
      }
    );

    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.responseData.error).toBe('VALIDATION_ERROR');
    expect(res.responseData.details[0].field).toBe('id');
  });

  it('rejects invalid ISO date format', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const { req, res, next } = createMockReqRes(
      { id: validUuid },
      {
        id: validUuid,
        date: '15-08-2026', // Wrong format
        timestamp: new Date().toISOString(),
        status: 'PRESENT',
        source: 'CAMERA',
      }
    );

    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.responseData.error).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown attendance status enum value', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const { req, res, next } = createMockReqRes(
      { id: validUuid },
      {
        id: validUuid,
        date: '2026-08-15',
        timestamp: new Date().toISOString(),
        status: 'SUPER_PRESENT', // Unknown enum
        source: 'CAMERA',
      }
    );

    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.responseData.error).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown scan source enum value', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const { req, res, next } = createMockReqRes(
      { id: validUuid },
      {
        id: validUuid,
        date: '2026-08-15',
        timestamp: new Date().toISOString(),
        status: 'PRESENT',
        source: 'BLUETOOTH', // Unknown source
      }
    );

    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.responseData.error).toBe('VALIDATION_ERROR');
  });
});
