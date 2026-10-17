import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.PAYDUNYA_MODE = 'sandbox';
process.env.PAYDUNYA_MASTER_KEY = 'test-master-key';
process.env.PAYDUNYA_PRIVATE_KEY = 'test-private-key';
process.env.PAYDUNYA_TOKEN = 'test-token';
process.env.APP_URL = 'http://localhost:3000';

const { initDatabase, getDb } = await import('../src/server/db');
const {
  CheckoutError,
  createCheckout,
  getCheckoutStatus,
  handlePayDunyaNotification,
} = await import('../src/server/checkout');
const { paydunyaService } = await import('../src/server/paydunya');

const originalFetch = globalThis.fetch;
const userId = `usr_test_${crypto.randomUUID()}`;
const appA = `app_test_a_${crypto.randomUUID()}`;
const appB = `app_test_b_${crypto.randomUUID()}`;
const otherUserId = `usr_test_other_${crypto.randomUUID()}`;
const otherApp = `app_test_other_${crypto.randomUUID()}`;
const linkFixed = `link_fixed_${crypto.randomUUID()}`;
const linkVariable = `link_variable_${crypto.randomUUID()}`;
const linkUnsupported = `link_unsupported_${crypto.randomUUID()}`;
const createdInvoices = new Map<string, { amount: number; reference: string }>();

async function seedFixtures() {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
          VALUES (?, ?, 'test-hash', 'Test Merchant', ?, ?)`,
    args: [userId, `${userId}@example.test`, now, now],
  });
  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
          VALUES (?, ?, 'test-hash', 'Other Merchant', ?, ?)`,
    args: [otherUserId, `${otherUserId}@example.test`, now, now],
  });
  await db.execute({
    sql: `INSERT INTO applications (id, user_id, name, slug, created_at, updated_at)
          VALUES (?, ?, 'App A', ?, ?, ?), (?, ?, 'App B', ?, ?, ?),
                 (?, ?, 'Other App', ?, ?, ?)`,
    args: [
      appA, userId, appA, now, now,
      appB, userId, appB, now, now,
      otherApp, otherUserId, otherApp, now, now,
    ],
  });
  await db.execute({
    sql: `INSERT INTO payment_links
      (id, user_id, application_id, slug, title, description, amount, is_fixed_amount,
       currency, status, usage_count, require_phone, created_at, updated_at)
      VALUES
      (?, ?, ?, ?, 'Fixed product', 'Fixed price description', 5000, 1, 'XOF', 'active', 0, 1, ?, ?),
      (?, ?, ?, ?, 'Variable product', 'Variable price description', NULL, 0, 'XOF', 'active', 0, 1, ?, ?),
      (?, ?, ?, ?, 'Unsupported product', 'Unsupported currency', NULL, 0, 'GHS', 'active', 0, 1, ?, ?)`,
    args: [
      linkFixed, userId, appA, `${linkFixed}-slug`, now, now,
      linkVariable, userId, appB, `${linkVariable}-slug`, now, now,
      linkUnsupported, userId, appB, `${linkUnsupported}-slug`, now, now,
    ],
  });
}

function mockPayDunyaFetch(finalStatus: 'completed' | 'pending' = 'completed') {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/checkout-invoice/create')) {
      const payload = JSON.parse(String(init?.body)) as {
        invoice: { total_amount: number };
        custom_data: { reference: string };
      };
      const token = `test_${crypto.randomUUID()}`;
      createdInvoices.set(token, {
        amount: payload.invoice.total_amount,
        reference: payload.custom_data.reference,
      });
      return new Response(JSON.stringify({
        response_code: '00',
        response_text: `https://app.paydunya.com/sandbox-checkout/invoice/${token}`,
        token,
      }), { status: 200 });
    }

    const token = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
    const invoice = createdInvoices.get(token);
    assert.ok(invoice, 'confirmation must use a locally created invoice token');
    return new Response(JSON.stringify({
      response_code: '00',
      status: finalStatus,
      invoice: { token, total_amount: invoice.amount },
      custom_data: { reference: invoice.reference },
    }), { status: 200 });
  };
}

before(async () => {
  await initDatabase();
  await seedFixtures();
});

after(() => {
  globalThis.fetch = originalFetch;
});

test('fixed and variable links stay isolated by application through PayDunya confirmation', async () => {
  mockPayDunyaFetch();

  const fixed = await createCheckout({
    paymentLinkId: linkFixed,
    amount: 1,
    currency: 'XOF',
    customerName: 'Fixed Buyer',
    customerEmail: 'fixed@example.test',
    customerPhone: '+22997001234',
  }, 'fixed-link-attempt-01');
  assert.equal(fixed.baseAmount, 5000);
  assert.equal(fixed.totalAmount, 5000);
  assert.equal(fixed.feeAmount, 0);
  assert.equal(fixed.isSimulated, false);

  const fixedPending = await getDb().execute({
    sql: 'SELECT amount, application_id, provider, status FROM checkout_sessions WHERE reference = ?',
    args: [fixed.reference],
  });
  assert.equal(Number(fixedPending.rows[0].amount), 5000);
  assert.equal(String(fixedPending.rows[0].application_id), appA);
  assert.equal(String(fixedPending.rows[0].provider), 'paydunya');
  assert.equal(String(fixedPending.rows[0].status), 'pending');

  const confirmed = await getCheckoutStatus(fixed.reference);
  assert.equal(confirmed.status, 'success');

  const variable = await createCheckout({
    paymentLinkSlug: `${linkVariable}-slug`,
    amount: 3200,
    currency: 'XOF',
    customerName: 'Variable Buyer',
    customerEmail: 'variable@example.test',
    customerPhone: '+22997000001',
  }, 'variable-link-attempt-01');
  assert.equal(variable.totalAmount, 3200);
  const variableConfirmed = await getCheckoutStatus(variable.reference);
  assert.equal(variableConfirmed.status, 'success');

  const wallets = await getDb().execute({
    sql: 'SELECT application_id, balance, pending_balance FROM wallets WHERE user_id = ? ORDER BY application_id',
    args: [userId],
  });
  assert.deepEqual(
    wallets.rows.map((row) => [String(row.application_id), Number(row.balance), Number(row.pending_balance)]),
    [[appA, 0, 5000], [appB, 0, 3200]],
  );

  const transactions = await getDb().execute({
    sql: 'SELECT application_id, amount, status FROM transactions WHERE user_id = ? ORDER BY application_id',
    args: [userId],
  });
  assert.deepEqual(
    transactions.rows.map((row) => [String(row.application_id), Number(row.amount), String(row.status)]),
    [[appA, 5000, 'success'], [appB, 3200, 'success']],
  );
});

test('requires customer phone and rejects unsupported currency and inactive links', async () => {
  await assert.rejects(
    () => createCheckout({
      paymentLinkId: linkFixed,
      customerName: 'Buyer',
      customerEmail: 'buyer@example.test',
    }),
    (error: unknown) => error instanceof CheckoutError && error.statusCode === 400,
  );
  await assert.rejects(
    () => createCheckout({
      paymentLinkId: linkFixed,
      customerName: 'Buyer',
      customerEmail: 'buyer@example.test',
      customerPhone: '+221770000001',
    }),
    (error: unknown) => error instanceof CheckoutError && error.statusCode === 400,
  );
  await assert.rejects(
    () => createCheckout({
      paymentLinkId: linkUnsupported,
      amount: 3000,
      customerName: 'Buyer',
      customerEmail: 'buyer@example.test',
      customerPhone: '+233201234567',
    }),
    (error: unknown) => error instanceof CheckoutError && error.statusCode === 400,
  );
  await getDb().execute({
    sql: `UPDATE payment_links SET status = 'inactive' WHERE id = ?`,
    args: [linkFixed],
  });
  await assert.rejects(
    () => createCheckout({
      paymentLinkId: linkFixed,
      customerName: 'Buyer',
      customerEmail: 'buyer@example.test',
      customerPhone: '+22997001234',
    }),
    (error: unknown) => error instanceof CheckoutError && error.statusCode === 410,
  );
});

test('checkout idempotency is scoped to an application and stable within that application', async () => {
  mockPayDunyaFetch();
  await getDb().execute({
    sql: `UPDATE payment_links SET status = 'active' WHERE id = ?`,
    args: [linkFixed],
  });
  const sharedKey = 'same-order-key-across-apps';
  const inputA = {
    paymentLinkId: linkFixed,
    customerName: 'Idempotent Buyer',
    customerEmail: 'idempotent@example.test',
    customerPhone: '+22997000003',
  };
  const firstA = await createCheckout(inputA, sharedKey);
  const retryA = await createCheckout(inputA, sharedKey);
  assert.equal(retryA.reference, firstA.reference);

  const createdB = await createCheckout({
    paymentLinkId: linkVariable,
    amount: 2500,
    customerName: 'Idempotent Buyer',
    customerEmail: 'idempotent@example.test',
    customerPhone: '+22997000003',
  }, sharedKey);
  assert.notEqual(createdB.reference, firstA.reference);
  assert.equal(createdB.totalAmount, 2500);
});

test('PayDunya callback and repeated status checks credit an application only once', async () => {
  await getDb().execute({
    sql: `UPDATE payment_links SET status = 'active' WHERE id = ?`,
    args: [linkFixed],
  });
  mockPayDunyaFetch();

  const result = await createCheckout({
    paymentLinkId: linkFixed,
    customerName: 'Webhook Buyer',
    customerEmail: 'webhook@example.test',
    customerPhone: '+22997001234',
  }, 'webhook-attempt-0001');
  const invoice = await getDb().execute({
    sql: 'SELECT paydunya_token FROM checkout_sessions WHERE reference = ?',
    args: [result.reference],
  });
  const token = String(invoice.rows[0].paydunya_token);
  const hash = crypto.createHash('sha512').update(process.env.PAYDUNYA_MASTER_KEY || '').digest('hex');

  await handlePayDunyaNotification({ data: { hash, invoice: { token } } });
  await handlePayDunyaNotification({ data: { hash, invoice: { token } } });
  await getCheckoutStatus(result.reference);

  const wallet = await getDb().execute({
    sql: 'SELECT pending_balance FROM wallets WHERE user_id = ? AND application_id = ? AND currency = ?',
    args: [userId, appA, 'XOF'],
  });
  assert.equal(Number(wallet.rows[0].pending_balance), 10000);
});

test('pending provider status is never reported as a confirmed payment', async () => {
  mockPayDunyaFetch('pending');
  const checkout = await createCheckout({
    paymentLinkId: linkVariable,
    amount: 4200,
    customerName: 'Pending Buyer',
    customerEmail: 'pending@example.test',
    customerPhone: '+22997000002',
  }, 'pending-link-attempt-01');

  const status = await getCheckoutStatus(checkout.reference);
  assert.equal(status.status, 'pending');
  assert.equal(status.success, true);
});

test('wallet reads require an owned application and exclude unassigned legacy balances', async () => {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionToken = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [`ses_${crypto.randomUUID()}`, userId, sessionToken, new Date(Date.now() + 3600000).toISOString(), now],
  });
  await db.execute({
    sql: `INSERT INTO wallets
      (id, user_id, application_id, currency, symbol, balance, pending_balance,
       reserved_balance, country_code, is_default, created_at, updated_at)
      VALUES (?, ?, NULL, 'XOF', 'FCFA', 90000, 0, 0, 'BJ', 1, ?, ?)`,
    args: [`wal_legacy_${crypto.randomUUID()}`, userId, now, now],
  });

  const { GET, POST } = await import('../src/app/api/wallets/route');
  const ownRequest = new NextRequest(`http://localhost/api/wallets?applicationId=${appA}`, {
    headers: { cookie: `pf_auth_token=${sessionToken}` },
  });
  const ownResponse = await GET(ownRequest);
  assert.equal(ownResponse.status, 200);
  const ownBody = await ownResponse.json() as { wallets: Array<{ balance: number; pendingBalance: number }> };
  assert.deepEqual(ownBody.wallets.map((wallet) => [wallet.balance, wallet.pendingBalance]), [[0, 10000]]);

  const foreignRequest = new NextRequest(`http://localhost/api/wallets?applicationId=${otherApp}`, {
    headers: { cookie: `pf_auth_token=${sessionToken}` },
  });
  const foreignResponse = await GET(foreignRequest);
  assert.equal(foreignResponse.status, 404);

  const unsupportedCountryResponse = await POST(new NextRequest('http://localhost/api/wallets', {
    method: 'POST',
    headers: { cookie: `pf_auth_token=${sessionToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      applicationId: appA,
      countryCode: 'CI',
      currency: 'XOF',
    }),
  }));
  assert.equal(unsupportedCountryResponse.status, 400);
});

test('checkout session history requires an owned application and returns only its sessions', async () => {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionToken = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [`ses_${crypto.randomUUID()}`, userId, sessionToken, new Date(Date.now() + 3600000).toISOString(), now],
  });

  const { GET } = await import('../src/app/api/checkout-sessions/route');
  const headers = { cookie: `pf_auth_token=${sessionToken}` };
  const missingApplication = await GET(
    new NextRequest('http://localhost/api/checkout-sessions', { headers }),
  );
  assert.equal(missingApplication.status, 400);

  const ownApplication = await GET(
    new NextRequest(`http://localhost/api/checkout-sessions?applicationId=${appA}`, { headers }),
  );
  assert.equal(ownApplication.status, 200);
  const ownBody = await ownApplication.json() as {
    checkoutSessions: Array<{ applicationId?: string; amount: number; paydunyaUrl?: string }>;
  };
  assert.ok(ownBody.checkoutSessions.length > 0);
  assert.ok(ownBody.checkoutSessions.every((session) => session.amount === 5000));

  const foreignApplication = await GET(
    new NextRequest(`http://localhost/api/checkout-sessions?applicationId=${otherApp}`, { headers }),
  );
  assert.equal(foreignApplication.status, 404);
});

test('transactions and statistics require an owned application and stay isolated', async () => {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionToken = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [`ses_${crypto.randomUUID()}`, userId, sessionToken, new Date(Date.now() + 3600000).toISOString(), now],
  });

  const { GET: getTransactions } = await import('../src/app/api/transactions/route');
  const headers = { cookie: `pf_auth_token=${sessionToken}` };
  const missingApplication = await getTransactions(
    new NextRequest('http://localhost/api/transactions', { headers }),
  );
  assert.equal(missingApplication.status, 400);

  const ownTransactionsResponse = await getTransactions(
    new NextRequest(`http://localhost/api/transactions?applicationId=${appA}`, { headers }),
  );
  assert.equal(ownTransactionsResponse.status, 200);
  const ownTransactions = await ownTransactionsResponse.json() as {
    transactions: Array<{ id: string; reference: string }>;
  };
  assert.ok(ownTransactions.transactions.length > 0);
  const expectedTransactions = await db.execute({
    sql: `SELECT reference FROM transactions
          WHERE user_id = ? AND application_id = ? ORDER BY created_at DESC LIMIT 50 OFFSET 0`,
    args: [userId, appA],
  });
  assert.deepEqual(
    ownTransactions.transactions.map((transaction) => transaction.reference),
    expectedTransactions.rows.map((transaction) => String(transaction.reference)),
  );

  const foreignApplicationResponse = await getTransactions(
    new NextRequest(`http://localhost/api/transactions?applicationId=${otherApp}`, { headers }),
  );
  assert.equal(foreignApplicationResponse.status, 404);

  const transactionId = ownTransactions.transactions[0].id;
  const { GET: getTransaction } = await import('../src/app/api/transactions/[id]/route');
  const ownTransactionResponse = await getTransaction(
    new NextRequest(`http://localhost/api/transactions/${transactionId}?applicationId=${appA}`, { headers }),
    { params: Promise.resolve({ id: transactionId }) },
  );
  assert.equal(ownTransactionResponse.status, 200);

  const crossApplicationTransactionResponse = await getTransaction(
    new NextRequest(`http://localhost/api/transactions/${transactionId}?applicationId=${appB}`, { headers }),
    { params: Promise.resolve({ id: transactionId }) },
  );
  assert.equal(crossApplicationTransactionResponse.status, 404);

  const { GET: getStats } = await import('../src/app/api/stats/overview/route');
  const missingStatsApplication = await getStats(
    new NextRequest('http://localhost/api/stats/overview', { headers }),
  );
  assert.equal(missingStatsApplication.status, 400);
  const ownStatsResponse = await getStats(
    new NextRequest(`http://localhost/api/stats/overview?applicationId=${appA}`, { headers }),
  );
  assert.equal(ownStatsResponse.status, 200);
  const ownStats = await ownStatsResponse.json() as { stats: { totalTransactions: number } };
  const expectedCount = await db.execute({
    sql: `SELECT COUNT(*) AS total FROM transactions
          WHERE user_id = ? AND application_id = ? AND created_at >= ?`,
    args: [userId, appA, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
  });
  assert.equal(ownStats.stats.totalTransactions, Number(expectedCount.rows[0].total));

  const foreignStatsResponse = await getStats(
    new NextRequest(`http://localhost/api/stats/overview?applicationId=${otherApp}`, { headers }),
  );
  assert.equal(foreignStatsResponse.status, 404);
});

test('payment-link creation is application-scoped and limited to the configured checkout', async () => {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionToken = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [`ses_${crypto.randomUUID()}`, userId, sessionToken, new Date(Date.now() + 3600000).toISOString(), now],
  });

  const { POST } = await import('../src/app/api/payment-links/route');
  const createLink = (body: Record<string, unknown>) => POST(
    new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { cookie: `pf_auth_token=${sessionToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const common = {
    description: 'Payment-link API test',
    currency: 'XOF',
    country: 'BJ',
    applicationId: appA,
  };

  const fixedResponse = await createLink({
    ...common,
    title: 'Fixed API link',
    amount: 6400,
    isFixedAmount: true,
  });
  assert.equal(fixedResponse.status, 200);
  const fixedBody = await fixedResponse.json() as {
    paymentLink: { id: string; amount: number; isFixedAmount: boolean };
  };
  assert.equal(fixedBody.paymentLink.amount, 6400);
  assert.equal(fixedBody.paymentLink.isFixedAmount, true);

  const variableResponse = await createLink({
    ...common,
    title: 'Variable API link',
    isFixedAmount: false,
  });
  assert.equal(variableResponse.status, 200);
  const variableBody = await variableResponse.json() as {
    paymentLink: { id: string; amount?: number; isFixedAmount: boolean };
  };
  assert.equal(variableBody.paymentLink.amount, undefined);
  assert.equal(variableBody.paymentLink.isFixedAmount, false);

  const persisted = await db.execute({
    sql: 'SELECT id, amount, is_fixed_amount, require_phone FROM payment_links WHERE id IN (?, ?)',
    args: [fixedBody.paymentLink.id, variableBody.paymentLink.id],
  });
  assert.equal(persisted.rows.length, 2);
  assert.ok(persisted.rows.every((row) => Number(row.require_phone) === 1));

  assert.equal((await createLink({
    ...common,
    title: 'Unsupported currency',
    amount: 1000,
    currency: 'XAF',
  })).status, 400);
  assert.equal((await createLink({
    ...common,
    title: 'Unsupported country',
    amount: 1000,
    country: 'CI',
  })).status, 400);
  assert.equal((await createLink({
    ...common,
    title: 'Foreign application',
    amount: 1000,
    applicationId: otherApp,
  })).status, 404);
});

test('PayDunya invoice confirmation rejects invalid tokens before any request', async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}', { status: 200 });
  };
  await assert.rejects(() => paydunyaService.confirmInvoice('../invalid'));
  assert.equal(called, false);
});

test('versioned Pitchflow API keys cannot create or inspect payments across applications', async () => {
  mockPayDunyaFetch();
  const db = getDb();
  const now = new Date().toISOString();
  const secretA = `pf_test_${crypto.randomBytes(32).toString('base64url')}`;
  const secretB = `pf_test_${crypto.randomBytes(32).toString('base64url')}`;
  const createApiKey = async (id: string, appId: string, secret: string) => {
    await db.execute({
      sql: `INSERT INTO api_credentials
        (id, user_id, application_id, name, environment, prefix, secret_key,
         secret_masked, secret_hash, scope, is_active, created_at)
        VALUES (?, ?, ?, 'Integration test', 'sandbox', ?, '', ?, ?, 'payin', 1, ?)`,
      args: [
        id, userId, appId, secret.slice(0, 16), `${secret.slice(0, 16)}…`,
        crypto.createHash('sha256').update(secret).digest('hex'), now,
      ],
    });
  };
  await createApiKey(`key_test_${crypto.randomUUID()}`, appA, secretA);
  await createApiKey(`key_test_${crypto.randomUUID()}`, appB, secretB);

  const { POST } = await import('../src/app/api/v1/checkout-sessions/route');
  const { GET } = await import('../src/app/api/v1/payments/[reference]/route');
  const createRequest = (secret: string, link: string, idempotencyKey: string) =>
    new NextRequest('http://localhost/api/v1/checkout-sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        paymentLinkId: link,
        amount: 1,
        customerName: 'API Buyer',
        customerEmail: 'api-buyer@example.test',
        customerPhone: '+22997001234',
      }),
    });

  const foreignLinkResponse = await POST(createRequest(secretA, linkVariable, 'api-foreign-link-0001'));
  assert.equal(foreignLinkResponse.status, 404);

  const createdResponse = await POST(createRequest(secretA, linkFixed, 'api-session-create-0001'));
  assert.equal(createdResponse.status, 201);
  const createdBody = await createdResponse.json() as {
    data: { reference: string; amount: number; status: string };
  };
  assert.equal(createdBody.data.amount, 5000);
  assert.equal(createdBody.data.status, 'pending');

  const foreignStatusResponse = await GET(
    new NextRequest(`http://localhost/api/v1/payments/${createdBody.data.reference}`, {
      headers: { authorization: `Bearer ${secretB}` },
    }),
    { params: Promise.resolve({ reference: createdBody.data.reference }) },
  );
  assert.equal(foreignStatusResponse.status, 404);

  const ownStatusResponse = await GET(
    new NextRequest(`http://localhost/api/v1/payments/${createdBody.data.reference}`, {
      headers: { authorization: `Bearer ${secretA}` },
    }),
    { params: Promise.resolve({ reference: createdBody.data.reference }) },
  );
  assert.equal(ownStatusResponse.status, 200);
  const ownStatus = await ownStatusResponse.json() as { data: { status: string; amount: number } };
  assert.deepEqual(ownStatus.data, {
    id: createdBody.data.reference,
    reference: createdBody.data.reference,
    status: 'success',
    amount: 5000,
    currency: 'XOF',
  });
});

test('legacy direct confirmation, retry, and provider-reference routes are disabled', async () => {
  const { POST: confirm } = await import('../src/app/api/checkout/confirm/route');
  const { POST: retry } = await import('../src/app/api/checkout/retry/route');
  const { GET: reference } = await import('../src/app/api/reference/[...segments]/route');
  const { POST: retiredWebhook } = await import('../src/app/api/webhooks/saspay/route');
  const { GET: unavailableV1Route } = await import('../src/app/api/v1/[...segments]/route');

  assert.equal((await confirm()).status, 410);
  assert.equal((await retry()).status, 410);
  assert.equal((await retiredWebhook()).status, 410);
  assert.equal(
    (await reference(new NextRequest('http://localhost/api/reference/networks'))).status,
    410,
  );
  assert.equal((await unavailableV1Route()).status, 404);

  const { handleApiRequest } = await import('../src/server/adapter');
  const legacyFallback = await handleApiRequest(
    new Request('http://localhost/api/checkout/initiate', { method: 'POST' }),
  );
  assert.equal(legacyFallback.status, 410);
  const unavailableFallback = await handleApiRequest(
    new Request('http://localhost/api/v1/payments/create'),
  );
  assert.equal(unavailableFallback.status, 404);
});
