import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

Reflect.set(process.env, 'NODE_ENV', 'test');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.SMTP_MOCK = 'true';

const { initDatabase, getDb } = await import('../src/server/db');
const { createApiApp } = await import('../src/server/app');
const { normalizeApiUrl } = await import('../src/server/vercel-handler');
let server: ReturnType<ReturnType<typeof createApiApp>['listen']> | undefined;

before(async () => {
  await initDatabase();
  server = createApiApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await getDb().close();
});

test('auth API validates requests, persists accounts and sessions, and tolerates SMTP alert failure', async (t) => {
  const address = server?.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const email = `auth-${randomUUID()}@example.test`;
  const password = 'ValidPassword!234';
  const post = (route: string, body: unknown, token?: string) =>
    fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  await t.test('login and registration reject missing or invalid fields', async () => {
    const login = await post('/api/auth/login', {});
    assert.equal(login.status, 400);
    assert.equal((await login.json()).success, false);

    const registration = await post('/api/auth/register', { email, password });
    assert.equal(registration.status, 400);
  });

  await t.test('registers a valid account and confirms it using the persisted email code', async () => {
    const registration = await post('/api/auth/register', {
      email,
      password,
      fullName: 'Test Merchant',
      country: 'BJ',
    });
    assert.equal(registration.status, 200);
    assert.equal((await registration.json()).requireVerification, true);

    const codeResult = await getDb().execute({
      sql: 'SELECT code FROM email_verification_codes WHERE email = ?',
      args: [email],
    });
    assert.equal(codeResult.rows.length, 1);

    const verification = await post('/api/auth/verify-code', {
      email,
      code: String(codeResult.rows[0].code),
    });
    assert.equal(verification.status, 200);
    assert.equal((await verification.json()).success, true);
  });

  await t.test('rejects a duplicate verified account and incorrect password', async () => {
    const duplicate = await post('/api/auth/register', {
      email,
      password,
      fullName: 'Test Merchant',
      country: 'BJ',
    });
    assert.equal(duplicate.status, 400);

    const login = await post('/api/auth/login', { email, password: 'IncorrectPassword!' });
    assert.equal(login.status, 401);
  });

  await t.test('creates a persistent session and allows login when the alert SMTP is unavailable', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    process.env.SMTP_MOCK = 'false';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASSWORD = '';

    const login = await post('/api/auth/login', { email, password });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(loginBody.success, true);
    assert.equal(typeof loginBody.token, 'string');

    const sessions = await getDb().execute({
      sql: 'SELECT token FROM sessions WHERE token = ?',
      args: [loginBody.token],
    });
    assert.equal(sessions.rows.length, 1);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, email);

    const logout = await post('/api/auth/logout', {}, loginBody.token);
    assert.equal(logout.status, 200);

    const expiredSession = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(expiredSession.status, 401);
  });

  await t.test('resets passwords with a one-time code and invalidates existing sessions', async () => {
    const login = await post('/api/auth/login', { email, password });
    assert.equal(login.status, 200);
    const sessionToken = (await login.json()).token;

    const request = await post('/api/auth/forgot-password', { email });
    assert.equal(request.status, 200);

    const resetCode = await getDb().execute({
      sql: 'SELECT code FROM email_verification_codes WHERE email = ?',
      args: [email],
    });
    assert.equal(resetCode.rows.length, 1);

    const reset = await post('/api/auth/reset-password', {
      email,
      code: String(resetCode.rows[0].code),
      newPassword: 'AnotherValidPassword!234',
    });
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).success, true);

    const invalidatedSession = await getDb().execute({
      sql: 'SELECT token FROM sessions WHERE token = ?',
      args: [sessionToken],
    });
    assert.equal(invalidatedSession.rows.length, 0);

    const oldPassword = await post('/api/auth/login', { email, password });
    assert.equal(oldPassword.status, 401);
    const newPassword = await post('/api/auth/login', {
      email,
      password: 'AnotherValidPassword!234',
    });
    assert.equal(newPassword.status, 200);
  });

  await t.test('returns JSON 404 for unknown routes and 502 when registration mail cannot be sent', async () => {
    const unknown = await fetch(`${baseUrl}/api/route-that-does-not-exist`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get('content-type') || '', /application\/json/i);

    const registration = await post('/api/auth/register', {
      email: `smtp-${randomUUID()}@example.test`,
      password,
      fullName: 'SMTP Test',
      country: 'BJ',
    });
    assert.equal(registration.status, 502);
    assert.equal((await registration.json()).emailSent, false);
  });
});

test('normalizes Vercel function paths before Express routing', () => {
  assert.equal(normalizeApiUrl('/auth/login?next=%2Fdashboard', '/api'), '/api/auth/login?next=%2Fdashboard');
  assert.equal(normalizeApiUrl('/login?next=%2Fdashboard', '/api/auth'), '/api/auth/login?next=%2Fdashboard');
  assert.equal(normalizeApiUrl('/auth/login', '/api/auth'), '/api/auth/login');
  assert.equal(normalizeApiUrl('/api/login', '/api/auth'), '/api/auth/login');
  assert.equal(normalizeApiUrl('/api/auth/login?next=%2Fdashboard', '/api/auth'), '/api/auth/login?next=%2Fdashboard');
});

test('production database configuration fails clearly when required Turso variables are missing', () => {
  const script = [
    "process.env.NODE_ENV = 'production';",
    "process.env.VERCEL = '1';",
    "process.env.TURSO_DATABASE_URL = '';",
    "process.env.TURSO_AUTH_TOKEN = '';",
    "const { getDb } = await import('./src/server/db.ts');",
    "try { getDb(); process.exitCode = 1; } catch (error) {",
    "  if (!String(error.message).includes('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN')) throw error;",
    '}',
  ].join('\n');
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', script],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL: '1',
        TURSO_DATABASE_URL: '',
        TURSO_AUTH_TOKEN: '',
      },
    }
  );
  assert.equal(result.status, 0, result.stderr);
});
