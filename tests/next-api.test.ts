import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

Reflect.set(process.env, 'NODE_ENV', 'test');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.SMTP_MOCK = 'true';
process.env.PAYDUNYA_MODE = 'sandbox';

const { initDatabase, getDb } = await import('../src/server/db');
const { GET: health } = await import('../src/app/api/health/route');
const { POST: register } = await import('../src/app/api/auth/register/route');
const { POST: verifyCode } = await import('../src/app/api/auth/verify-code/route');
const { POST: login } = await import('../src/app/api/auth/login/route');
const { GET: me } = await import('../src/app/api/auth/me/route');
const { POST: logout } = await import('../src/app/api/auth/logout/route');
const { GET: listApps, POST: createApp } = await import('../src/app/api/apps/route');
const { GET: listCustomers, POST: createCustomer } = await import('../src/app/api/customers/route');
const { PUT: updateCustomer, DELETE: deleteCustomer } = await import('../src/app/api/customers/[id]/route');
const { POST: createPaymentLink } = await import('../src/app/api/payment-links/route');
const {
  GET: getPaymentLink,
  PUT: updatePaymentLink,
} = await import('../src/app/api/payment-links/[id]/route');
const { POST: createApiKey, GET: listApiKeys } = await import('../src/app/api/developer/keys/route');
const { DELETE: revokeApiKey } = await import('../src/app/api/developer/keys/[id]/route');
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
  const firstApplication = (await createdApp.json()).application as { id: string };
  const secondAppResponse = await createApp(
    makeRequest(
      '/api/apps',
      'POST',
      { name: 'Second test application' },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(secondAppResponse.status, 200);
  const secondApplication = (await secondAppResponse.json()).application as { id: string };

  const apiKeyResponse = await createApiKey(
    makeRequest(
      '/api/developer/keys',
      'POST',
      {
        name: 'Sandbox integration',
        environment: 'sandbox',
        applicationId: firstApplication.id,
      },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(apiKeyResponse.status, 200);
  const createdKey = (await apiKeyResponse.json()).apiKey as {
    id: string;
    secretKey: string;
    environment: string;
  };
  assert.match(createdKey.secretKey, /^pf_test_/);
  assert.equal(createdKey.environment, 'sandbox');
  const liveKeyResponse = await createApiKey(
    makeRequest(
      '/api/developer/keys',
      'POST',
      {
        name: 'Live integration',
        environment: 'live',
        applicationId: firstApplication.id,
      },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(liveKeyResponse.status, 409);
  const crossApplicationKeyRevoke = await revokeApiKey(
    makeRequest(
      `/api/developer/keys/${createdKey.id}?applicationId=${secondApplication.id}`,
      'DELETE',
      undefined,
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: createdKey.id }) },
  );
  assert.equal(crossApplicationKeyRevoke.status, 404);
  const stillOwnedKeys = await listApiKeys(
    makeRequest(
      `/api/developer/keys?applicationId=${firstApplication.id}`,
      'GET',
      undefined,
      undefined,
      sessionCookie,
    ),
  );
  assert.equal((await stillOwnedKeys.json()).apiKeys.length, 1);
  const revokeKeyResponse = await revokeApiKey(
    makeRequest(
      `/api/developer/keys/${createdKey.id}?applicationId=${firstApplication.id}`,
      'DELETE',
      undefined,
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: createdKey.id }) },
  );
  assert.equal(revokeKeyResponse.status, 200);

  const paymentLinkResponse = await createPaymentLink(
    makeRequest(
      '/api/payment-links',
      'POST',
      {
        title: 'Migration verification link',
        amount: 5000,
        isFixedAmount: true,
        usageLimit: 4,
        applicationId: firstApplication.id,
      },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(paymentLinkResponse.status, 200);
  const paymentLink = (await paymentLinkResponse.json()).paymentLink as { id: string };
  const updateLinkResponse = await updatePaymentLink(
    makeRequest(
      `/api/payment-links/${paymentLink.id}?applicationId=${firstApplication.id}`,
      'PUT',
      { amount: 6500, usageLimit: 8 },
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: paymentLink.id }) },
  );
  assert.equal(updateLinkResponse.status, 200);
  const linkResult = await getPaymentLink(
    makeRequest(
      `/api/payment-links/${paymentLink.id}?applicationId=${firstApplication.id}`,
      'GET',
      undefined,
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: paymentLink.id }) },
  );
  assert.equal(linkResult.status, 200);
  const linkDetails = (await linkResult.json()).paymentLink;
  assert.equal(linkDetails.amount, 6500);
  assert.equal(linkDetails.usageLimit, 8);
  const invalidLimitUpdate = await updatePaymentLink(
    makeRequest(
      `/api/payment-links/${paymentLink.id}?applicationId=${firstApplication.id}`,
      'PUT',
      { usageLimit: 0 },
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: paymentLink.id }) },
  );
  assert.equal(invalidLimitUpdate.status, 400);

  const customerResponse = await createCustomer(
    makeRequest(
      '/api/customers',
      'POST',
      {
        name: 'Application A customer',
        email: `customer-${randomUUID()}@example.test`,
        applicationId: firstApplication.id,
      },
      undefined,
      sessionCookie,
    ),
  );
  assert.equal(customerResponse.status, 200);
  const customer = (await customerResponse.json()).customer as { id: string };

  const unscopedCustomers = await listCustomers(
    makeRequest('/api/customers', 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(unscopedCustomers.status, 400);
  const customersFromSecondApplication = await listCustomers(
    makeRequest(
      `/api/customers?applicationId=${secondApplication.id}`,
      'GET',
      undefined,
      undefined,
      sessionCookie,
    ),
  );
  assert.deepEqual((await customersFromSecondApplication.json()).customers, []);
  const customersFromFirstApplication = await listCustomers(
    makeRequest(
      `/api/customers?applicationId=${firstApplication.id}`,
      'GET',
      undefined,
      undefined,
      sessionCookie,
    ),
  );
  assert.equal((await customersFromFirstApplication.json()).customers.length, 1);

  const crossApplicationUpdate = await updateCustomer(
    makeRequest(
      `/api/customers/${customer.id}?applicationId=${secondApplication.id}`,
      'PUT',
      { name: 'Tampered customer' },
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: customer.id }) },
  );
  assert.equal(crossApplicationUpdate.status, 404);
  const scopedUpdate = await updateCustomer(
    makeRequest(
      `/api/customers/${customer.id}?applicationId=${firstApplication.id}`,
      'PUT',
      { name: 'Updated customer' },
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: customer.id }) },
  );
  assert.equal(scopedUpdate.status, 200);
  const crossApplicationDelete = await deleteCustomer(
    makeRequest(
      `/api/customers/${customer.id}?applicationId=${secondApplication.id}`,
      'DELETE',
      undefined,
      undefined,
      sessionCookie,
    ),
    { params: Promise.resolve({ id: customer.id }) },
  );
  assert.equal(crossApplicationDelete.status, 404);

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
  const listedApplications = (await authenticatedApps.json()).applications as Array<{ name: string }>;
  assert.deepEqual(
    listedApplications.map((application) => application.name).sort(),
    ['Second test application', 'Test-owned application'].sort(),
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
