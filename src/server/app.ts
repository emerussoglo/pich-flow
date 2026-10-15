import express from 'express';
import { apiRouter } from './api';

export function createApiApp() {
  const app = express();

  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'PichFlow Payment Core',
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'Route API introuvable.' });
  });

  app.post('/webhooks/saspay', (req, res, next) => {
    req.url = '/webhooks/saspay';
    apiRouter(req, res, next);
  });

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const errorWithStatus = err as Error & { status?: number; body?: unknown };
    if (errorWithStatus instanceof SyntaxError && errorWithStatus.status === 400 && 'body' in errorWithStatus) {
      res.status(400).json({ success: false, error: 'Le corps de la requête JSON est invalide.' });
      return;
    }

    if (errorWithStatus.status === 413) {
      res.status(413).json({ success: false, error: 'La requête est trop volumineuse.' });
      return;
    }

    console.error('[API] Unhandled request error:', err);
    res.status(500).json({ success: false, error: 'Une erreur interne est survenue.' });
  });

  return app;
}
