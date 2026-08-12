import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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
import { executeSql } from './src/db/index';

export async function createApp() {
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

  // CSRF Protection for state-changing requests authenticated via cookies
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.cookies?.session) {
      const origin = req.headers.origin || req.headers.referer;
      const host = req.headers.host;

      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return res.status(403).json({
              error: 'CSRF_ORIGIN_MISMATCH',
              message: 'Cross-site request forgery protection block',
            });
          }
        } catch {
          return res.status(403).json({
            error: 'INVALID_ORIGIN_HEADER',
            message: 'Invalid origin header on mutating request',
          });
        }
      }
    }
    next();
  });

  // 2. Memory-Based API Rate Limiting Middleware with Active Pruning
  const ipRequests = new Map<string, { count: number; resetAt: number }>();
  const loginRequests = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
  const RATE_LIMIT_MAX_REQUESTS = 500; // generous threshold for API & mobile sync
  const LOGIN_LIMIT_MAX_REQUESTS = 5; // strict threshold for authentication attempts

  // Periodic pruning every 5 minutes to prevent memory accumulation
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRequests.entries()) {
      if (now > data.resetAt) ipRequests.delete(ip);
    }
    for (const [key, data] of loginRequests.entries()) {
      if (now > data.resetAt) loginRequests.delete(key);
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();

  // Strict Login Rate Limiter Middleware (Runs AFTER express.json() so req.body.phoneNumber is present)
  app.use('/api/v1/auth/login', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const phone = req.body?.phoneNumber || '';
    const key = `${ip}:${phone}`;
    const now = Date.now();
    const loginData = loginRequests.get(key);

    if (!loginData || now > loginData.resetAt) {
      loginRequests.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      next();
    } else if (loginData.count >= LOGIN_LIMIT_MAX_REQUESTS) {
      res.status(429).json({
        error: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Too many login attempts. Please try again after 15 minutes.',
      });
    } else {
      loginData.count++;
      next();
    }
  });

  app.use('/api/v1', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rateData = ipRequests.get(ip);

    if (!rateData || now > rateData.resetAt) {
      ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      next();
    } else if (rateData.count >= RATE_LIMIT_MAX_REQUESTS) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again after 15 minutes.',
      });
    } else {
      rateData.count++;
      next();
    }
  });

  // Database migrations and seed data are deployment concerns. Run
  // `npm run migrate` and, only for an explicit development environment,
  // `npm run seed` before starting the web process.

  // 3. Liveness and Readiness Probes
  app.get(['/livez', '/api/v1/livez'], (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'school-attendance-backend', timestamp: new Date().toISOString() });
  });

  app.get(['/readyz', '/api/v1/readyz', '/api/v1/health'], async (_req, res) => {
    try {
      await executeSql('SELECT 1;');
      res.status(200).json({
        status: 'ok',
        service: 'school-attendance-backend',
        timestamp: new Date().toISOString(),
        database: 'healthy',
        env: env.NODE_ENV,
      });
    } catch (err) {
      res.status(503).json({
        status: 'error',
        service: 'school-attendance-backend',
        timestamp: new Date().toISOString(),
        database: 'unhealthy',
        env: env.NODE_ENV,
      });
    }
  });

  // API Router registration
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/schools', schoolRouter);
  app.use('/api/v1/schools', academicRouter);
  app.use('/api/v1/schools', studentRouter);
  app.use('/api/v1/schools', importRouter);
  app.use('/api/v1/schools', qrRouter);
  app.use('/api/v1/schools/:schoolId/attendance', attendanceRouter);
  app.use('/api/v1/schools/:schoolId/sync', syncRouter);
  app.use('/api/v1/schools/:schoolId/devices', deviceRouter);
  app.use('/api/v1/schools/:schoolId/reports', reportRouter);
  app.use('/api/v1/schools/:schoolId/audit-logs', auditRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/v1/notifications', notificationRouter);

  // Development: Vite Middleware / Production Static Assets
  if (process.env.NODE_ENV !== 'production' && process.env.TEST_SERVER_STATIC !== 'true') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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

if (process.env.NODE_ENV !== 'test' && process.env.RUN_SERVER !== 'false') {
  void startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exitCode = 1;
  });
}
