import { initDatabase } from './server/db';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initDatabase();
  }
}
