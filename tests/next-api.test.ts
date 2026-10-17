import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

Reflect.set(process.env, 'NODE_ENV', 'test');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.SMTP_MOCK = 'true';

const { initDatabase, getDb } = await import('../src/server/db');
const { GET: health } = await import('../src/app/api/health/route');
const { POST: register } = await import('../src/app/api/auth/register/route');
const { POST: verifyCode } = await import('../src/app/api/auth/verify-code/route');
const { POST: login } = await import('../src/app/api/auth/login/route');
const { GET: me } = await import('../src/app/api/auth/me/route');
const { POST: logout } = await import('../src/app/api/auth/logout/route');
const { GET: listApps, POST: createApp } = await import('../src/app/api/apps/route');
const { handleApiRequest } = await import('../src/server/adapter');

function makeRequest(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
  cookie?: string,
): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost'), {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  await initDatabase();
});

after(async () => {
  await getDb().close();
});

test('Next route handlers preserve authentication and legacy API behavior', async () => {
  const healthResponse = await health();
  assert.equal(healthResponse.status, 200);

  const email = `next-${randomUUID()}@example.test`;
  const password = 'TestOnly-ValidPassword-456!';

  const invalidRegistration = await register(
    makeRequest('/api/auth/register', 'POST', {
      email: 'invalid-email',
      password,
      fullName: 'Test Merchant',
    }),
  );
  assert.equal(invalidRegistration.status, 400);

  const registration = await register(
    makeRequest('/api/auth/register', 'POST', {
      email,
      password,
      fullName: 'Test Merchant',
      country: 'BJ',
    }),
  );
  assert.equal(registration.status, 200);

  const verificationCode = await getDb().execute({
    sql: 'SELECT code FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    args: [email],
  });
  assert.equal(verificationCode.rows.length, 1);

  const verification = await verifyCode(
    makeRequest('/api/auth/verify-code', 'POST', {
      email,
      code: String(verificationCode.rows[0].code),
    }),
  );
  assert.equal(verification.status, 200);

  const incorrectLogin = await login(
    makeRequest('/api/auth/login', 'POST', {
      email,
      password: 'Wrong-Password-123!',
    }),
  );
  assert.equal(incorrectLogin.status, 401);

  const unauthenticated = await me(makeRequest('/api/auth/me', 'GET'));
  assert.equal(unauthenticated.status, 401);
  const unauthenticatedApps = await listApps(makeRequest('/api/apps', 'GET'));
  assert.equal(unauthenticatedApps.status, 401);

  const successfulLogin = await login(
    makeRequest('/api/auth/login', 'POST', { email, password }),
  );
  assert.equal(successfulLogin.status, 200);
  const setCookie = successfulLogin.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /httponly/i);
  const sessionCookie = setCookie.split(';', 1)[0];
  const { token } = (await successfulLogin.json()) as { token: string };
  assert.ok(token);

  const authenticated = await me(makeRequest('/api/auth/me', 'GET', undefined, token));
  assert.equal(authenticated.status, 200);
  const cookieAuthenticated = await me(
    makeRequest('/api/auth/me', 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(cookieAuthenticated.status, 200);

  const createdApp = await createApp(
    makeRequest(
      '/api/apps',
      'POST',
      { name: 'Test-owned application' },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(createdApp.status, 200);

  const authenticatedApps = await listApps(
    makeRequest(
      '/api/apps',
      'GET',
      undefined,
      'expired-or-revoked-token',
      sessionCookie,
    ),
  );
  assert.equal(authenticatedApps.status, 200);
  assert.equal(
    (await authenticatedApps.json()).applications[0].name,
    'Test-owned application',
  );

  const logoutResponse = await logout(
    makeRequest('/api/auth/logout', 'POST', undefined, undefined, sessionCookie),
  );
  assert.equal(logoutResponse.status, 200);

  const afterLogout = await me(makeRequest('/api/auth/me', 'GET', undefined, token));
  assert.equal(afterLogout.status, 401);
  const appsAfterLogout = await listApps(
    makeRequest('/api/apps', 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(appsAfterLogout.status, 401);

  const legacyReference = await handleApiRequest(
    new Request('http://localhost/api/reference/countries'),
  );
  assert.equal(legacyReference.status, 410);
});
