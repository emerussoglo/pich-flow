process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_URL = 'http://localhost:3000';

const { initDatabase, getDb } = await import('../src/server/db');
const { handleApiRequest } = await import('../src/server/adapter');

if (process.env.PAYDUNYA_MODE !== 'sandbox') {
  throw new Error('Sandbox test aborted because PAYDUNYA_MODE is not sandbox.');
}

await initDatabase();
const db = getDb();
const now = new Date().toISOString();
const userId = 'sandbox-user';
const applicationId = 'sandbox-app';
const paymentLinkId = 'sandbox-link';

await db.execute({
  sql: 'INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  args: [userId, 'sandbox@example.invalid', 'unused', 'Sandbox Test', now, now],
});
await db.execute({
  sql: 'INSERT INTO applications (id, user_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  args: [applicationId, userId, 'Sandbox Test', 'sandbox-test', now, now],
});
await db.execute({
  sql: `INSERT INTO payment_links (
          id, user_id, application_id, slug, title, description, amount,
          is_fixed_amount, currency, country, status, usage_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'XOF', 'BJ', 'active', 0, ?, ?)`,
  args: [
    paymentLinkId, userId, applicationId, 'sandbox-test-link',
    'PichFlow sandbox verification', 'Temporary isolated sandbox invoice test',
    200, now, now,
  ],
});

const response = await handleApiRequest(new Request('http://localhost/api/checkout/initiate', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'idempotency-key': `sbx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  },
  body: JSON.stringify({
    paymentLinkId,
    firstName: 'Sandbox',
    lastName: 'Test',
    customerEmail: 'sandbox@example.invalid',
    customerPhone: '+22900000000',
  }),
}));
const result = await response.json();
const saved = await db.execute({
  sql: 'SELECT status, paydunya_token, paydunya_url FROM checkout_sessions WHERE reference = ?',
  args: [result.reference || ''],
});
const session = saved.rows[0];

console.log(JSON.stringify({
  mode: 'sandbox',
  httpStatus: response.status,
  success: result.success === true,
  hasInvoiceUrl: typeof result.invoiceUrl === 'string'
    && result.invoiceUrl.startsWith('https://app.paydunya.com/'),
  sessionStatus: session ? String(session.status) : null,
  invoiceTokenStored: Boolean(session?.paydunya_token),
  error: result.success ? undefined : result.error,
}));

await db.close();
if (response.status !== 200 || result.success !== true || !session?.paydunya_token) {
  process.exitCode = 1;
}
