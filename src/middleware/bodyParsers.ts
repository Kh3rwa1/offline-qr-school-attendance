import express, { type Request, type Response, type NextFunction } from 'express';

export const LIMITS = {
  zebraWebhook: 512 * 1024,
  smsCallback: 64 * 1024,
  default: 100 * 1024,
  form: 32 * 1024,
} as const;

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
  (req as RawBodyRequest).rawBody = Buffer.from(buf); // copy; don't hold parser's buffer
};

export const zebraJsonParser = express.json({
  limit: LIMITS.zebraWebhook,
  verify: captureRawBody,
  type: ['application/json', 'application/*+json'],
  strict: false, // Zebra may send a root-level array
});

export const smsCallbackParser = express.json({
  limit: LIMITS.smsCallback,
  verify: captureRawBody,
});

export const defaultJsonParser = express.json({
  limit: LIMITS.default,
});

export const defaultFormParser = express.urlencoded({
  extended: false,
  limit: LIMITS.form,
  parameterLimit: 100,
});

/** Map body-parser failures to clean 4xx responses. Never echo parser messages. */
export function bodyParserErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const map: Record<string, [number, string]> = {
    'entity.too.large': [413, 'PAYLOAD_TOO_LARGE'],
    'entity.parse.failed': [400, 'MALFORMED_JSON'],
    'entity.verify.failed': [400, 'MALFORMED_BODY'],
    'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING'],
    'charset.unsupported': [415, 'UNSUPPORTED_CHARSET'],
    'parameters.too.many': [413, 'TOO_MANY_PARAMETERS'],
  };
  const hit = err?.type && map[err.type];
  if (!hit) return next(err);
  return res.status(hit[0]).json({ success: false, error: hit[1], requestId: (req as any).id });
}
