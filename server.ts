import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'node:fs';
import { env } from './src/env';
import { authRouter } from './src/routes/authRoutes';
import { schoolRouter } from './src/routes/schoolRoutes';
import { deviceRouter } from './src/routes/deviceRoutes';
import { academicRouter } from './src/routes/academicRoutes';
import { studentRouter } from './src/routes/studentRoutes';
import { importRouter } from './src/routes/importRoutes';
import { qrRouter } from './src/routes/qrRoutes';
import attendanceRouter from './src/routes/attendanceRoutes';
import syncRouter from './src/routes/syncRoutes';
import reportRouter from './src/routes/reportRoutes';
import { governmentReportRouter } from './src/routes/governmentReportRoutes';
import auditRouter, { platformAuditRouter } from './src/routes/auditRoutes';
import notificationRouter from './src/routes/notificationRoutes';
import { rfidRouter } from './src/routes/rfidRoutes';
import { dashboardRouter } from './src/routes/dashboardRoutes';
import { systemHealthRouter } from './src/routes/systemHealthRoutes';
import { publicRouter } from './src/routes/publicRoutes';
import { setupRouter } from './src/routes/setupRoutes';
import { calendarRouter } from './src/routes/calendarRoutes';
import { platformSettingsRouter } from './src/routes/platformSettingsRoutes';
import { executeSql } from './src/db/index';
import { metricsMiddleware, renderPrometheusMetrics } from './src/middleware/metrics';
import { rateLimitPolicies } from './src/middleware/distributedRateLimiter';
import { csrfProtection } from './src/middleware/csrfProtection';
import { resolveSchoolId } from './src/middleware/resolveSchoolId';
import { initRedis } from './src/services/redisService';
import {
  zebraJsonParser,
  smsCallbackParser,
  defaultJsonParser,
  defaultFormParser,
  bodyParserErrorHandler,
} from './src/middleware/bodyParsers';
import { errorMiddleware } from './src/http/errorMiddleware';
import crypto from 'node:crypto';
import pinoHttp from 'pino-http';
import { inflightTracker, installGracefulShutdown, isDraining } from './src/http/shutdown';
import { logger } from './src/lib/logger';

export async function createApp() {
  if (process.env.NODE_ENV === 'production' && !process.env.METRICS_AUTH_TOKEN) {
    throw new Error('FATAL: METRICS_AUTH_TOKEN environment variable must be set in production mode.');
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
    const { runMigrations } = await import('./src/db/migrate');
    const { seedDatabase } = await import('./src/db/seed');
    await runMigrations();
    await seedDatabase();
  }

  await initRedis();

  const app = express();
  app.set('trust proxy', 1);

  app.use(inflightTracker);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const inc = req.headers['x-request-id'];
        const id = typeof inc === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(inc) ? inc : crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      serializers: {
        req: (r) => ({ id: r.id, method: r.method, url: (r.url ?? '').split('?')[0] }),
      },
      customLogLevel: (_req, res, err) =>
        err || (res.statusCode && res.statusCode >= 500)
          ? 'error'
          : res.statusCode && res.statusCode >= 400
            ? 'warn'
            : 'info',
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health' || req.url === '/metrics' || req.url === '/readyz',
      },
    })
  );

  // Route-specific parsers FIRST (parse only, then fall through via next())
  app.post('/api/v1/schools/:schoolId/rfid/zebra/reads', zebraJsonParser);
  app.post('/api/v1/notifications/callback', smsCallbackParser);

  // Global parsers skip anything already parsed
  app.use(defaultJsonParser);
  app.use(defaultFormParser);
  app.use(bodyParserErrorHandler);
  app.use(cookieParser());

  app.use((req, res, next) => {
    const cspScriptSrc =
      process.env.NODE_ENV === 'production'
        ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://www.youtube-nocookie.com; frame-ancestors 'self';"
        : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://www.youtube-nocookie.com; frame-ancestors 'self';";

    res.setHeader('Content-Security-Policy', cspScriptSrc);
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  app.use('/api/v1/auth/login', rateLimitPolicies.login);
  app.use('/api/v1/notifications/callback', rateLimitPolicies.callback);
  app.use('/api/v1/notifications/process-queue', rateLimitPolicies.adminQueue);
  app.use('/api', rateLimitPolicies.generalApi, csrfProtection, resolveSchoolId);

  app.use(metricsMiddleware);

  app.get('/metrics', async (req, res) => {
    const result = await renderPrometheusMetrics(req);
    if (!result.authorized) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(result.content);
  });

  app.get(['/api/v1/health', '/healthz', '/livez'], async (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'school-attendance-backend', timestamp: new Date().toISOString() });
  });

  app.get('/readyz', async (_req, res) => {
    if (isDraining()) {
      return res.status(503).json({
        status: 'draining',
        service: 'school-attendance-backend',
        timestamp: new Date().toISOString(),
      });
    }
    try {
      await executeSql('SELECT 1');
      res.status(200).json({
        status: 'ready',
        service: 'school-attendance-backend',
        db: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'unready',
        service: 'school-attendance-backend',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use('/api/v1/setup', setupRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin/platform-settings', platformSettingsRouter);
  app.use('/api/v1', dashboardRouter);
  app.use('/api/v1/schools', schoolRouter);
  app.use('/api/v1/schools', academicRouter);
  app.use('/api/v1/schools', studentRouter);
  app.use('/api/v1/schools', rateLimitPolicies.import, importRouter);
  app.use('/api/v1/schools', qrRouter);
  if (process.env.FEATURE_RFID === 'true') {
    app.use('/api/v1/schools', rfidRouter);
  }
  app.use('/api/v1/schools/:schoolId/attendance', attendanceRouter);
  app.use('/api/v1/schools/:schoolId/sync', rateLimitPolicies.sync, syncRouter);
  app.use('/api/v1/schools/:schoolId/devices', deviceRouter);
  app.use('/api/v1/schools/:schoolId/calendar', calendarRouter);
  app.use('/api/v1/schools/:schoolId/reports', rateLimitPolicies.reports, governmentReportRouter);
  app.use('/api/v1/schools/:schoolId/reports', rateLimitPolicies.reports, reportRouter);
  app.use('/api/v1/schools/:schoolId/audit-logs', auditRouter);
  app.use('/api/v1/audit', platformAuditRouter);
  app.use('/api/v1/system', systemHealthRouter);
  app.use('/api/v1/schools/:schoolId/notifications', notificationRouter);
  app.use('/api/v1/notifications', notificationRouter);

  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API_ENDPOINT_NOT_FOUND',
      message: 'The requested API endpoint was not found on this server.',
    });
  });

  app.get('/runtime-env.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.send(`window.__FEATURE_RFID__ = ${process.env.FEATURE_RFID === 'true'};`);
  });

  if (process.env.NODE_ENV !== 'production' && process.env.TEST_SERVER_STATIC !== 'true') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.resolve(distPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      if (process.env.NODE_ENV === 'production' && process.env.TEST_SERVER_STATIC !== 'true') {
        throw new Error(
          'FATAL_PRODUCTION_ASSET_MISSING: dist/index.html was not found. Build the frontend production bundle before starting the server.'
        );
      }
    }

    const indexHtmlContent = fs.existsSync(indexHtmlPath)
      ? fs.readFileSync(indexHtmlPath, 'utf8')
      : '<!DOCTYPE html><html><head><title>Offline Attendance</title></head><body><div id="root"></div></body></html>';

    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          if (normalizedPath.includes('/assets/') && /\.(js|mjs|css)$/.test(normalizedPath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (
            normalizedPath.endsWith('.html') ||
            normalizedPath.endsWith('/sw.js') ||
            normalizedPath.endsWith('/manifest.json') ||
            normalizedPath.endsWith('/font-loader.js') ||
            normalizedPath.endsWith('/theme-loader.js') ||
            normalizedPath.endsWith('/runtime-env.js')
          ) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else if (/\.(jpe?g|png|webp|svg|ico|woff2?)$/.test(normalizedPath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
        },
      })
    );

    app.get('*', rateLimitPolicies.spaFallback, (req, res, next) => {
      if (!req.path.startsWith('/api')) {
        return res.type('html').send(indexHtmlContent);
      }
      next();
    });
  }

  app.use(errorMiddleware);

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = Number(env.PORT || 3000);
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server listening on http://0.0.0.0:${PORT}`);
  });

  installGracefulShutdown(server);
  return server;
}

if (process.env.NODE_ENV !== 'test' && process.env.RUN_SERVER !== 'false' && !process.env.VITEST) {
  void startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exitCode = 1;
  });
}
