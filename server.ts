import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compiledServer = path.resolve(__dirname, 'dist-server', 'server.js');
const isExplicitDev = process.env.npm_lifecycle_event === 'dev';

async function bootstrap() {
  if (fs.existsSync(compiledServer) && !isExplicitDev) {
    // Production runtime / standard node server.ts: load compiled bundle
    const mod = await import('file://' + compiledServer);
    if (typeof mod.startServer === 'function') {
      await mod.startServer();
    }
  } else {
    // Development mode with Vite HMR/middlewares (tsx server.ts)
    const { startServer } = await import('./src/server/main.ts');
    await startServer();
  } 
}

bootstrap().catch((err) => {
  console.error('[PichFlow] Bootstrap error:', err);
  process.exit(1);
});
