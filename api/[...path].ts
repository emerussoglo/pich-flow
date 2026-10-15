import type { Request, Response } from 'express';
import { createApiApp } from '../src/server/app';
import { initDatabase } from '../src/server/db';

let appPromise: Promise<ReturnType<typeof createApiApp>> | undefined;

function getApp(): Promise<ReturnType<typeof createApiApp>> {
  if (!appPromise) {
    appPromise = initDatabase()
      .then(() => createApiApp())
      .catch((error) => {
        appPromise = undefined;
        throw error;
      });
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const app = await getApp();
    app(req, res);
  } catch (error) {
    console.error('[Vercel API] Failed to initialize API handler:', error);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Le service est temporairement indisponible. Veuillez réessayer plus tard.',
      });
    }
  }
}
