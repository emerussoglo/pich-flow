import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createApiApp } from './app';
import { initDatabase } from './db';
import { seedInitialDataIfNeeded } from './seed';

let appInstance: ReturnType<typeof createApiApp> | null = null;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

async function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await initDatabase();
        await seedInitialDataIfNeeded();
        dbInitialized = true;
      } catch (err) {
        console.error('[PichFlow Next.js API] Database init error:', err);
        dbInitPromise = null;
        throw err;
      }
    })();
  }
  return dbInitPromise;
}

function getApp(): ReturnType<typeof createApiApp> {
  if (!appInstance) {
    appInstance = createApiApp();
  }
  return appInstance;
}

export async function handleApiRequest(webRequest: Request): Promise<Response> {
  await ensureDbInitialized();
  const app = getApp();

  const urlObj = new URL(webRequest.url);
  const pathname = urlObj.pathname;
  const search = urlObj.search;
  const fullPath = pathname + search;

  const bodyBuffer = Buffer.from(await webRequest.arrayBuffer());

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.url = fullPath;
  req.method = webRequest.method;

  webRequest.headers.forEach((val, key) => {
    req.headers[key.toLowerCase()] = val;
  });

  // Provide body to the incoming message stream
  req.push(bodyBuffer);
  req.push(null);

  return new Promise<Response>((resolve, reject) => {
    let statusCode = 200;
    let statusMessage = 'OK';
    const responseHeaders: Record<string, string | string[]> = {};
    const chunks: Buffer[] = [];

    const res = new ServerResponse(req);

    res.writeHead = function (
      code: number,
      reasonPhraseOrHeaders?: any,
      headers?: any
    ): any {
      statusCode = code;
      const h = typeof reasonPhraseOrHeaders === 'object' ? reasonPhraseOrHeaders : headers;
      if (h) {
        Object.entries(h).forEach(([k, v]) => {
          if (v !== undefined) {
            responseHeaders[k.toLowerCase()] = v as any;
          }
        });
      }
      return this;
    };

    res.setHeader = function (name: string, value: any): any {
      if (value !== undefined) {
        responseHeaders[name.toLowerCase()] = value;
      }
      return this;
    };

    res.getHeader = function (name: string): any {
      return responseHeaders[name.toLowerCase()];
    };

    res.removeHeader = function (name: string): any {
      delete responseHeaders[name.toLowerCase()];
      return this;
    };

    res.write = function (chunk: any): any {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    };

    res.end = function (chunk?: any): any {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const responseBody = Buffer.concat(chunks);

      const finalHeaders = new Headers();
      for (const [key, value] of Object.entries(responseHeaders)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            finalHeaders.append(key, String(v));
          }
        } else if (value !== undefined) {
          finalHeaders.set(key, String(value));
        }
      }

      resolve(
        new Response(responseBody, {
          status: statusCode,
          statusText: statusMessage,
          headers: finalHeaders,
        })
      );
      return this;
    };

    try {
      app(req, res);
    } catch (err) {
      console.error('[PichFlow Next.js API] App error:', err);
      reject(err);
    }
  });
}

