import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';

process.env.NODE_ENV = 'test';
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
    customerPhone: '+221770000001',
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
    customerPhone: '+221770000002',
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

  const { GET } = await import('../src/app/api/wallets/route');
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
