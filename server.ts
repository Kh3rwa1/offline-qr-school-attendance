import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
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
import auditRouter from './src/routes/auditRoutes';
import notificationRouter from './src/routes/notificationRoutes';
import { rfidRouter } from './src/routes/rfidRoutes';
import { dashboardRouter } from './src/routes/dashboardRoutes';
import { executeSql } from './src/db/index';
import { metricsMiddleware, renderPrometheusMetrics } from './src/middleware/metrics';
import { rateLimitPolicies } from './src/middleware/distributedRateLimiter';
import { csrfProtection } from './src/middleware/csrfProtection';
import { initRedis } from './src/services/redisService';

export async function createApp() {
  if (process.env.NODE_ENV === 'production' && !process.env.METRICS_AUTH_TOKEN) {
    throw new Error('FATAL: METRICS_AUTH_TOKEN environment variable must be set in production mode.');
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
        ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data:; frame-ancestors 'self';"
        : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data:; frame-ancestors 'self';";

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

  // Production-grade CSRF protection for cookie-authenticated mutating requests
  app.use(csrfProtection);

  // 2. Memory-Based API Rate Limiting Middleware with Active Pruning  // Distributed Rate Limiters
  app.use('/api/v1/auth/login', rateLimitPolicies.login);
  app.use('/api/v1/notifications/callback', rateLimitPolicies.callback);
  app.use('/api/v1/notifications/process-queue', rateLimitPolicies.adminQueue);
  app.use('/api/v1', rateLimitPolicies.generalApi);

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

  // Health and Readiness Probes
  app.get(['/api/v1/health', '/healthz'], async (_req, res) => {
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
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', dashboardRouter);
  app.use('/api/v1/schools', schoolRouter);
  app.use('/api/v1/schools', academicRouter);
  app.use('/api/v1/schools', studentRouter);
  app.use('/api/v1/schools', importRouter);
  app.use('/api/v1/schools', qrRouter);
  app.use('/api/v1/schools', rateLimitPolicies.rfidScan ?? rateLimitPolicies.generalApi);
  app.use('/api/v1/schools', rfidRouter);
  app.use('/api/v1/schools/:schoolId/attendance', attendanceRouter);
  app.use('/api/v1/schools/:schoolId/sync', syncRouter);
  app.use('/api/v1/schools/:schoolId/devices', deviceRouter);
  app.use('/api/v1/schools/:schoolId/reports', reportRouter);
  app.use('/api/v1/schools/:schoolId/audit-logs', auditRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/v1/notifications', notificationRouter);

  // 404 Handler for Unknown API Endpoints
  app.all('/api/*', (_req, res) => {
    return res.status(404).json({
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
    app.use(express.static(distPath));

    // Rate-limited bounded SPA fallback
    app.use(rateLimitPolicies.spaFallback);
    app.use((req, res, next) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!req.path.startsWith('/api')) {
          return res.sendFile(indexHtmlPath);
        }
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
