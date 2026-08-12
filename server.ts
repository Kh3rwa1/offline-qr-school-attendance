import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { env } from './src/env';
import { runMigrations } from './src/db/migrate';
import { seedDatabase } from './src/db/seed';
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

async function startServer() {
  const app = express();
  const PORT = parseInt(env.PORT || '3000', 10);

  // 1. Security Headers & CSP Middleware
  app.use((req, res, next) => {
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self' data:; frame-ancestors 'self';"
    );
    // HSTS (Strict-Transport-Security) - 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Anti-Clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // MIME Sniffing Protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    next();
  });

  // 2. Memory-Based API Rate Limiting Middleware
  const ipRequests = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
  const RATE_LIMIT_MAX_REQUESTS = 500; // generous but safe threshold for mobile sync

  app.use('/api/v1', (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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

  // Body and cookie parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize DB tables and seeds
  try {
    await runMigrations();
    await seedDatabase();
  } catch (err) {
    console.error('Database setup failed on startup:', err);
  }

  // 3. Health check and Readiness check endpoint
  app.get('/api/v1/health', async (req, res) => {
    let dbStatus = 'healthy';
    try {
      await executeSql('SELECT 1;');
    } catch (err) {
      dbStatus = 'unhealthy';
    }

    res.json({
      status: dbStatus === 'healthy' ? 'ok' : 'error',
      service: 'school-attendance-backend',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      env: env.NODE_ENV,
    });
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

  // Development: Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static assets from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

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

startServer();
