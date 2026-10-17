import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

Reflect.set(process.env, 'NODE_ENV', 'test');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.SMTP_MOCK = 'true';

const { initDatabase, getDb } = await import('../src/server/db');
const { GET: health } = await import('../src/app/api/health/route');
const { POST: disabledLegacyWebhook } = await import('../src/app/webhooks/saspay/route');
const { POST: register } = await import('../src/app/api/auth/register/route');
const { POST: verifyCode } = await import('../src/app/api/auth/verify-code/route');
const { POST: login } = await import('../src/app/api/auth/login/route');
const { GET: me } = await import('../src/app/api/auth/me/route');
const { POST: logout } = await import('../src/app/api/auth/logout/route');
const { POST: forgotPassword } = await import('../src/app/api/auth/forgot-password/route');
const { POST: resetPassword } = await import('../src/app/api/auth/reset-password/route');
const { GET: listApps, POST: createApp } = await import('../src/app/api/apps/route');
const { POST: selectApp } = await import('../src/app/api/apps/active/route');
const { GET: listPaymentLinks, POST: createPaymentLink } = await import('../src/app/api/payment-links/route');
const { GET: listApiKeys, POST: createApiKey } = await import('../src/app/api/developer/keys/route');
const { DELETE: revokeApiKey } = await import('../src/app/api/developer/keys/[id]/route');
const { GET: listTransactions } = await import('../src/app/api/transactions/route');
const { GET: getTransaction } = await import('../src/app/api/transactions/[id]/route');
const { GET: listCheckoutSessions } = await import('../src/app/api/checkout-sessions/route');
const { GET: getStats } = await import('../src/app/api/stats/overview/route');
const { GET: listCustomers, POST: createCustomer } = await import('../src/app/api/customers/route');
const { PUT: updateCustomer } = await import('../src/app/api/customers/[id]/route');
const { POST: createPayoutMethod } = await import('../src/app/api/payout-methods/route');
const { GET: listWallets } = await import('../src/app/api/wallets/route');
const { GET: listWebhooks, POST: createWebhook } = await import('../src/app/api/developer/webhooks/route');
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
  const orphanWallets = await getDb().execute('SELECT COUNT(*) AS count FROM wallets');
  assert.equal(Number(orphanWallets.rows[0].count), 0);
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
  const applicationA = (await createdApp.json()).application;

  const createdSecondApp = await createApp(
    makeRequest('/api/apps', 'POST', { name: 'Second test application' }, undefined, sessionCookie),
  );
  assert.equal(createdSecondApp.status, 200);
  const applicationB = (await createdSecondApp.json()).application;

  const selectApplication = async (applicationId: string) => selectApp(
    makeRequest('/api/apps/active', 'POST', { applicationId }, undefined, sessionCookie),
  );
  assert.equal((await selectApplication(applicationA.id)).status, 200);
  const belowPayDunyaMinimum = await createPaymentLink(
    makeRequest('/api/payment-links', 'POST', {
      title: 'Below provider minimum',
      amount: 199,
      currency: 'XOF',
      country: 'BJ',
      applicationId: applicationA.id,
    }, undefined, sessionCookie),
  );
  assert.equal(belowPayDunyaMinimum.status, 400);
  const payoutMethodResponse = await createPayoutMethod(
    makeRequest('/api/payout-methods', 'POST', {
      type: 'mobile_money',
      operatorOrBank: 'MTN',
      recipientName: 'Test Merchant',
      recipientPhoneOrIban: '+22990000000',
    }, undefined, sessionCookie),
  );
  assert.equal(payoutMethodResponse.status, 200);
  assert.equal((await payoutMethodResponse.json()).payoutMethod.isVerified, false);
  const walletListA = await listWallets(
    makeRequest(`/api/wallets?applicationId=${applicationA.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(walletListA.status, 200);
  const walletA = (await walletListA.json()).wallets[0];
  assert.equal(walletA.currency, 'XOF');
  const webhookAResponse = await createWebhook(
    makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.test/webhook',
      description: 'A-only webhook',
      applicationId: applicationA.id,
    }, undefined, sessionCookie),
  );
  assert.equal(webhookAResponse.status, 200);

  const linkAResponse = await createPaymentLink(
    makeRequest('/api/payment-links', 'POST', {
      title: 'Application A payment',
      amount: 1200,
      currency: 'XOF',
      country: 'BJ',
      maxPayments: 4,
      applicationId: applicationA.id,
    }, undefined, sessionCookie),
  );
  assert.equal(linkAResponse.status, 200);
  const linkA = (await linkAResponse.json()).paymentLink;
  const freeAmountLinkResponse = await createPaymentLink(
    makeRequest('/api/payment-links', 'POST', {
      title: 'Application A flexible payment',
      isFixedAmount: false,
      currency: 'XOF',
      country: 'BJ',
      applicationId: applicationA.id,
    }, undefined, sessionCookie),
  );
  assert.equal(freeAmountLinkResponse.status, 200);
  const freeAmountLink = (await freeAmountLinkResponse.json()).paymentLink;
  const belowMinimumCheckout = await handleApiRequest(
    new Request('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `below-min-${randomUUID()}`,
      },
      body: JSON.stringify({
        paymentLinkId: freeAmountLink.id,
        amount: 199,
        firstName: 'Checkout',
        lastName: 'Test',
        customerEmail: 'checkout-test@example.test',
        customerPhone: '+22990000000',
      }),
    }),
  );
  assert.equal(belowMinimumCheckout.status, 400);
  const storedLinkA = await getDb().execute({
    sql: 'SELECT usage_limit, usage_count FROM payment_links WHERE id = ? AND application_id = ?',
    args: [linkA.id, applicationA.id],
  });
  assert.deepEqual(
    { limit: Number(storedLinkA.rows[0].usage_limit), count: Number(storedLinkA.rows[0].usage_count) },
    { limit: 4, count: 0 },
  );

  const keyAResponse = await createApiKey(
    makeRequest('/api/developer/keys', 'POST', {
      name: 'Application A key',
      scope: 'both',
      applicationId: applicationA.id,
    }, undefined, sessionCookie),
  );
  assert.equal(keyAResponse.status, 200);
  const keyA = (await keyAResponse.json()).keys.sandbox;
  const storedKeyA = await getDb().execute({
    sql: 'SELECT prefix, secret_key, secret_hash FROM api_credentials WHERE id = ? AND application_id = ?',
    args: [keyA.id, applicationA.id],
  });
  assert.equal(storedKeyA.rows[0].prefix, keyA.prefix);
  assert.equal(storedKeyA.rows[0].secret_key, '');
  assert.equal(typeof storedKeyA.rows[0].secret_hash, 'string');

  const customerRequestBody = {
    name: 'Customer Creation',
    email: 'customer-creation@example.test',
    phone: '+22990000000',
    country: 'BJ',
    applicationId: applicationA.id,
  };
  const createdCustomer = await createCustomer(
    makeRequest('/api/customers', 'POST', customerRequestBody, undefined, sessionCookie),
  );
  assert.equal(createdCustomer.status, 200);
  const duplicateCustomer = await createCustomer(
    makeRequest('/api/customers', 'POST', { ...customerRequestBody, name: 'Customer Updated' }, undefined, sessionCookie),
  );
  assert.equal(duplicateCustomer.status, 200);
  const customerCount = await getDb().execute({
    sql: 'SELECT COUNT(*) AS count FROM customers WHERE application_id = ? AND lower(email) = ?',
    args: [applicationA.id, customerRequestBody.email],
  });
  assert.equal(Number(customerCount.rows[0].count), 1);

  const crossAppLinkRead = await listPaymentLinks(
    makeRequest(`/api/payment-links?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(crossAppLinkRead.status, 404);
  const crossAppLinkCreate = await createPaymentLink(
    makeRequest('/api/payment-links', 'POST', {
      title: 'Cross-application attempt',
      amount: 100,
      applicationId: applicationB.id,
    }, undefined, sessionCookie),
  );
  assert.equal(crossAppLinkCreate.status, 404);
  const crossAppKeyRead = await listApiKeys(
    makeRequest(`/api/developer/keys?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(crossAppKeyRead.status, 404);

  assert.equal((await selectApplication(applicationB.id)).status, 200);
  const walletListB = await listWallets(
    makeRequest(`/api/wallets?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(walletListB.status, 200);
  const walletB = (await walletListB.json()).wallets[0];
  assert.notEqual(walletA.id, walletB.id);
  const webhooksForB = await listWebhooks(
    makeRequest(`/api/developer/webhooks?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.deepEqual((await webhooksForB.json()).webhooks, []);
  const crossAppWebhooks = await listWebhooks(
    makeRequest(`/api/developer/webhooks?applicationId=${applicationA.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(crossAppWebhooks.status, 404);
  const linkBResponse = await createPaymentLink(
    makeRequest('/api/payment-links', 'POST', {
      title: 'Application B payment',
      amount: 2300,
      currency: 'XOF',
      country: 'BJ',
      applicationId: applicationB.id,
    }, undefined, sessionCookie),
  );
  assert.equal(linkBResponse.status, 200);
  const linkB = (await linkBResponse.json()).paymentLink;
  const linksForB = await listPaymentLinks(
    makeRequest(`/api/payment-links?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.deepEqual((await linksForB.json()).paymentLinks.map((link: { title: string }) => link.title), ['Application B payment']);

  const keyListForB = await listApiKeys(
    makeRequest(`/api/developer/keys?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal(keyListForB.status, 200);
  assert.deepEqual((await keyListForB.json()).apiKeys, []);

  const now = new Date().toISOString();
  for (const fixture of [
    { id: 'tx_app_a', appId: applicationA.id, ref: 'REF-APP-A', amount: 1200, customerId: 'customer_app_a', customerName: 'Customer A', linkId: linkA.id },
    { id: 'tx_app_b', appId: applicationB.id, ref: 'REF-APP-B', amount: 2300, customerId: 'customer_app_b', customerName: 'Customer B', linkId: linkB.id },
  ]) {
    const appOwner = await getDb().execute({
      sql: 'SELECT user_id FROM applications WHERE id = ?',
      args: [fixture.appId],
    });
    await getDb().execute({
      sql: `INSERT INTO transactions
            (id, user_id, application_id, reference, customer_name, customer_email, provider, amount, net_amount, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PayDunya', ?, ?, 'XOF', 'completed', ?, ?)`,
      args: [fixture.id, appOwner.rows[0].user_id, fixture.appId, fixture.ref, fixture.customerName, `${fixture.id}@example.test`, fixture.amount, fixture.amount, now, now],
    });
    await getDb().execute({
      sql: `INSERT INTO customers
            (id, user_id, application_id, name, email, phone, country, payment_count, total_spent, currency, last_transaction_at, created_at)
            SELECT ?, user_id, ?, ?, ?, '', 'BJ', 1, ?, 'XOF', ?, ? FROM applications WHERE id = ?`,
      args: [fixture.customerId, fixture.appId, fixture.customerName, `${fixture.id}@example.test`, fixture.amount, now, now, fixture.appId],
    });
    await getDb().execute({
      sql: `INSERT INTO checkout_sessions (id, user_id, payment_link_id, application_id, reference, amount, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'XOF', 'pending', ?, ?)`,
      args: [`checkout_${fixture.id}`, appOwner.rows[0].user_id, fixture.linkId, fixture.appId, fixture.ref, fixture.amount, now, now],
    });
  }

  const transactionsForB = await listTransactions(
    makeRequest(`/api/transactions?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.deepEqual((await transactionsForB.json()).transactions.map((tx: { reference: string }) => tx.reference), ['REF-APP-B']);
  const statsForB = await getStats(
    makeRequest(`/api/stats/overview?appId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  const statsForBData = (await statsForB.json()).stats;
  assert.equal(statsForBData.grossRevenue, 2300);
  assert.equal(statsForBData.netRevenue, null);
  assert.equal(statsForBData.feesConfirmed, false);
  const sessionsForB = await listCheckoutSessions(
    makeRequest(`/api/checkout-sessions?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.deepEqual((await sessionsForB.json()).checkoutSessions.map((session: { reference: string }) => session.reference), ['REF-APP-B']);
  const customersForB = await listCustomers(
    makeRequest(`/api/customers?applicationId=${applicationB.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  const customersForBData = (await customersForB.json()).customers;
  assert.deepEqual(customersForBData.map((customer: { name: string }) => customer.name), ['Customer B']);
  assert.equal(customersForBData[0].lastTransaction.reference, 'REF-APP-B');
  assert.equal(customersForBData[0].lastTransaction.paymentLinkTitle, 'Application B payment');

  const legacyKeyResponse = await handleApiRequest(
    new Request('http://localhost/api/v1/transactions', {
      headers: { Authorization: `Bearer ${keyA.secretKey}` },
    }),
  );
  assert.equal(legacyKeyResponse.status, 200);
  assert.deepEqual((await legacyKeyResponse.json()).transactions.map((tx: { reference: string }) => tx.reference), ['REF-APP-A']);
  const keyACrossAppDetail = await handleApiRequest(
    new Request('http://localhost/api/v1/transactions/tx_app_b', {
      headers: { Authorization: `Bearer ${keyA.secretKey}` },
    }),
  );
  assert.equal(keyACrossAppDetail.status, 404);

  assert.equal((await selectApplication(applicationA.id)).status, 200);
  const transactionsForA = await listTransactions(
    makeRequest(`/api/transactions?applicationId=${applicationA.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.deepEqual((await transactionsForA.json()).transactions.map((tx: { reference: string }) => tx.reference), ['REF-APP-A']);
  const transactionBThroughA = await getTransaction(
    makeRequest(`/api/transactions/tx_app_b`, 'GET', undefined, undefined, sessionCookie),
    { params: Promise.resolve({ id: 'tx_app_b' }) },
  );
  assert.equal(transactionBThroughA.status, 404);
  const crossAppCustomerMutation = await updateCustomer(
    makeRequest('/api/customers/customer_app_b', 'PUT', { name: 'Compromised' }, undefined, sessionCookie),
    { params: Promise.resolve({ id: 'customer_app_b' }) },
  );
  assert.equal(crossAppCustomerMutation.status, 404);
  const customersForA = await listCustomers(
    makeRequest(`/api/customers?applicationId=${applicationA.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  const customersForAData = (await customersForA.json()).customers;
  assert.deepEqual(
    customersForAData.map((customer: { name: string }) => customer.name).sort(),
    ['Customer A', 'Customer Updated'],
  );
  assert.ok(customersForAData.every((customer: { name: string }) => customer.name !== 'Customer B'));

  const revokeResponse = await revokeApiKey(
    makeRequest(`/api/developer/keys/${keyA.id}?applicationId=${applicationA.id}`, 'DELETE', undefined, undefined, sessionCookie),
    { params: Promise.resolve({ id: keyA.id }) },
  );
  assert.equal(revokeResponse.status, 200);
  const revokedKeys = await listApiKeys(
    makeRequest(`/api/developer/keys?applicationId=${applicationA.id}`, 'GET', undefined, undefined, sessionCookie),
  );
  assert.equal((await revokedKeys.json()).apiKeys.find((key: { id: string }) => key.id === keyA.id).isActive, false);
  const revokedKeyResponse = await handleApiRequest(
    new Request('http://localhost/api/v1/transactions', {
      headers: { Authorization: `Bearer ${keyA.secretKey}` },
    }),
  );
  assert.equal(revokedKeyResponse.status, 401);

  await initDatabase();
  const preservedApps = await getDb().execute({
    sql: 'SELECT id FROM applications WHERE id IN (?, ?)',
    args: [applicationA.id, applicationB.id],
  });
  assert.equal(preservedApps.rows.length, 2);

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
  const listedAppNames = (await authenticatedApps.json()).applications.map((app: { name: string }) => app.name);
  assert.ok(listedAppNames.includes('Test-owned application'));
  assert.ok(listedAppNames.includes('Second test application'));

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

  const resetRequest = await forgotPassword(
    makeRequest('/api/auth/forgot-password', 'POST', { email }),
  );
  assert.equal(resetRequest.status, 200);
  const storedResetRequest = await getDb().execute({
    sql: "SELECT code FROM email_verification_codes WHERE email = ? AND substr(id, 1, 5) = 'rset_'",
    args: [email],
  });
  assert.equal(storedResetRequest.rows.length, 1);
  assert.equal(String(storedResetRequest.rows[0].code).length, 64);

  const userRecord = await getDb().execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });
  await getDb().execute({
    sql: "DELETE FROM email_verification_codes WHERE email = ? AND substr(id, 1, 5) = 'rset_'",
    args: [email],
  });
  const resetToken = randomUUID().replace(/-/g, '').repeat(2);
  await getDb().execute({
    sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)`,
    args: [
      `rset_${randomUUID()}`,
      userRecord.rows[0].id,
      email,
      createHash('sha256').update(resetToken).digest('hex'),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    ],
  });
  const resetResponse = await resetPassword(
    makeRequest('/api/auth/reset-password', 'POST', {
      token: resetToken,
      newPassword: 'Updated-ValidPassword-789!',
    }),
  );
  assert.equal(resetResponse.status, 200);
  const consumedResetToken = await getDb().execute({
    sql: "SELECT id FROM email_verification_codes WHERE email = ? AND substr(id, 1, 5) = 'rset_' AND code = ?",
    args: [email, createHash('sha256').update(resetToken).digest('hex')],
  });
  assert.equal(consumedResetToken.rows.length, 0);

  const legacyReference = await handleApiRequest(
    new Request('http://localhost/api/reference/countries'),
  );
  assert.equal(legacyReference.status, 200);

  const checkoutBody = await handleApiRequest(
    new Request('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentLinkId: 'missing-checkout-link' }),
    }),
  );
  assert.equal(checkoutBody.status, 404);

  const disabledLegacyPayment = await handleApiRequest(
    new Request('http://localhost/api/v1/payments/create', { method: 'POST' }),
  );
  assert.equal(disabledLegacyPayment.status, 410);
  assert.equal((await disabledLegacyWebhook()).status, 410);
});
