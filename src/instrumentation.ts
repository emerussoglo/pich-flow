
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDatabase } = await import('./server/db');

    await initDatabase();
  }
}
