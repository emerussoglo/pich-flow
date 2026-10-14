import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import { seedInitialDataIfNeeded } from './seed';
import { apiRouter } from './api';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configuration: always honors process.env.PORT (Google Cloud Run / custom), fallback to 3000
const PORT = parseInt(process.env.PORT || '3000', 10);
const isExplicitDev = process.env.npm_lifecycle_event === 'dev';
const distPath = path.resolve(process.cwd(), 'dist');
const isProd = !isExplicitDev && (process.env.NODE_ENV === 'production' || fs.existsSync(distPath));

let serverStarted = false;

export async function startServer() {
  if (serverStarted) {
    return;
  }
  serverStarted = true;

  const app = express();

  // Basic middleware with rawBody capture for webhook HMAC verification
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS headers for API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check endpoint (always available before DB init so probes don't time out)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'PichFlow Payment Core',
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // Initialize database schema and initial data
  try {
    await initDatabase();
    await seedInitialDataIfNeeded();
  } catch (err) {
    console.error('[DB] Database startup error:', err);
  }

  // Mount API routes
  app.use('/api', apiRouter);

  // Direct alias for SasPay dashboard webhook URL (e.g. https://domain.com/webhooks/saspay)
  app.post('/webhooks/saspay', (req, res, next) => {
    req.url = '/webhooks/saspay';
    apiRouter(req, res, next);
  });

  if (!isProd) {
    // Mount Vite dev middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        const indexPath = path.resolve(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Not Found');
        }
      });
    } else {
      console.warn(`[PichFlow] Warning: dist directory not found at ${distPath}`);
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PichFlow] Server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });

  // Handle graceful shutdown for Google Cloud Run container lifecycle
  process.on('SIGTERM', () => {
    console.log('[PichFlow] SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('[PichFlow] HTTP server closed cleanly');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[PichFlow] SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('[PichFlow] HTTP server closed cleanly');
      process.exit(0);
    });
  });

  return server;
}

// Auto-run if executed directly as script (e.g. `node src/server/main.js`)
try {
  const currentPath = fileURLToPath(import.meta.url);
  if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentPath)) {
    startServer().catch((err) => {
      console.error('[PichFlow] Fatal startup error:', err);
      process.exit(1);
    });
  }
} catch {
  // Ignored in bundled environments
}
