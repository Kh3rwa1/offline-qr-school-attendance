import pino from 'pino';

export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: process.env.PG_APPLICATION_NAME ?? 'attendease-web' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    censor: '[REDACTED]',
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'req.headers["x-reader-signature"]',
      'req.headers["x-zebra-signature"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      '*.readerSecret',
      '*.phone',
      '*.guardianPhone',
      '*.contactNumber',
      '*.epc',
      '*.idHex',
      '*.tid',
      '*.tidHex',
      'internal.readerIdentifier',
    ],
  },
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
};

export const logger = pino(loggerOptions);
