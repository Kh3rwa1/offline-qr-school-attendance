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
import auditRouter, { platformAuditRouter } from './src/routes/auditRoutes';
import notificationRouter from './src/routes/notificationRoutes';
import { rfidRouter } from './src/routes/rfidRoutes';
import { dashboardRouter } from './src/routes/dashboardRoutes';
import { systemHealthRouter } from './src/routes/systemHealthRoutes';
import { publicRouter } from './src/routes/publicRoutes';
import { setupRouter } from './src/routes/setupRoutes';
import { executeSql } from './src/db/index';
import { metricsMiddleware, renderPrometheusMetrics } from './src/middleware/metrics';
import { rateLimitPolicies } from './src/middleware/distributedRateLimiter';
import { csrfProtection } from './src/middleware/csrfProtection';
import { initRedis } from './src/services/redisService';

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

  // Body and cookie parsing middleware with rawBody preservation
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // 1. Security Headers & CSP Middleware
  app.use((req, res, next) => {
    const cspScriptSrc =
      process.env.NODE_ENV === 'production'
        ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'self';"
        : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'self';";

    res.setHeader('Content-Security-Policy', cspScriptSrc);
    // HSTS (Strict-Transport-Security) - 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Anti-Clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // MIME Sniffing Protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Cache-Control: no-store for all sensitive API endpoints
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  // 1. API & Login Rate Limiting Middleware
  app.use('/api/v1/auth/login', rateLimitPolicies.login);
  app.use('/api/v1/notifications/callback', rateLimitPolicies.callback);
  app.use('/api/v1/notifications/process-queue', rateLimitPolicies.adminQueue);

  // 2. Production-grade CSRF protection & general API rate limiting (strictly single execution under /api)
  app.use('/api', rateLimitPolicies.generalApi, csrfProtection);

  // Database migrations and seed data are deployment concerns. Run
  // `npm run migrate` and, only for an explicit development environment,
  // `npm run seed` before starting the web process.

  // Metrics middleware & endpoint
  app.use(metricsMiddleware);

  app.get('/metrics', (req, res) => {
    const result = renderPrometheusMetrics(req);
    if (!result.authorized) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(result.content);
  });

  // Health, Liveness, and Readiness Probes
  app.get(['/api/v1/health', '/healthz', '/livez'], async (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'school-attendance-backend', timestamp: new Date().toISOString() });
  });

  app.get('/readyz', async (_req, res) => {
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

  // API Router registration
  app.use('/api/v1/setup', setupRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/auth', authRouter);
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
  app.use('/api/v1/schools/:schoolId/reports', rateLimitPolicies.reports, reportRouter);
  app.use('/api/v1/schools/:schoolId/audit-logs', auditRouter);
  app.use('/api/v1/audit', platformAuditRouter);
  app.use('/api/v1/system', systemHealthRouter);
  app.use('/api/v1/schools/:schoolId/notifications', notificationRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/v1/notifications', notificationRouter);

  // Strict 404 handler for unmatched API routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API_ENDPOINT_NOT_FOUND',
      message: 'The requested API endpoint was not found on this server.',
    });
  });

  // Development: Vite Middleware / Production Static Assets
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

    // Static asset caching strategy:
    // - Vite build output under /assets/ is content-hashed -> immutable 1-year cache
    // - HTML shell, service worker, manifest, font loader -> always revalidate so deploys propagate
    // - Images/fonts (rarely changed) -> 1 day cache + 1 week stale-while-revalidate
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
            normalizedPath.endsWith('/font-loader.js')
          ) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else if (/\.(jpe?g|png|webp|svg|ico|woff2?)$/.test(normalizedPath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
        },
      })
    );

    // Rate-limited in-memory SPA fallback (zero per-request filesystem I/O)
    app.get('*', rateLimitPolicies.spaFallback, (req, res, next) => {
      if (!req.path.startsWith('/api')) {
        return res.type('html').send(indexHtmlContent);
      }
      next();
    });
  }

  // Global Production Error Handler (Sanitizes stack traces & internal database errors)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === 'production' && status === 500
        ? 'An unexpected error occurred. Please try again later.'
        : err.message || 'INTERNAL_SERVER_ERROR';

    res.status(status).json({
      success: false,
      error: 'SERVER_ERROR',
      message,
    });
  });

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = parseInt(env.PORT || '3000', 10);
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  // 4. Graceful Shutdown
  const shutdown = () => {
    console.log('SIGTERM/SIGINT received. Starting graceful shutdown...');
    server.close(() => {
      console.log('HTTP server closed.');
      // Keep any database cleanup or logs processing here
      process.exit(0);
    });

    // Force shutdown after 10s if connections persist
    setTimeout(() => {
      console.error('Forcing shutdown as connections did not close in time.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.env.NODE_ENV !== 'test' && process.env.RUN_SERVER !== 'false' && !process.env.VITEST) {
  void startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exitCode = 1;
  });
}
