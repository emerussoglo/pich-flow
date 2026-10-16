import type { Request, Response } from 'express';
import { createApiApp } from './app';
import { initDatabase } from './db';

let appPromise: Promise<ReturnType<typeof createApiApp>> | undefined;

export function normalizeApiUrl(requestUrl: string | undefined, routePrefix: string): string {
  const parsedUrl = new URL(requestUrl || '/', 'http://vercel.local');
  const requestPath = parsedUrl.pathname;
  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
    if (
      routePrefix === '/api/auth' &&
      requestPath !== '/api/auth' &&
      !requestPath.startsWith('/api/auth/')
    ) {
      return `/api/auth${requestPath.slice('/api'.length)}${parsedUrl.search}`;
    }
    return `${requestPath}${parsedUrl.search}`;
  }

  const prefix =
    routePrefix === '/api/auth' &&
    (requestPath === '/auth' || requestPath.startsWith('/auth/'))
      ? '/api'
      : routePrefix;
  const path = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  return `${prefix}${path}${parsedUrl.search}`;
}

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

export function createVercelHandler(routePrefix = '/api') {
  return async function handler(req: Request, res: Response): Promise<void> {
    req.url = normalizeApiUrl(req.url, routePrefix);
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
  };
}

export default createVercelHandler();
