import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import { createClient, type Client } from '@libsql/client';
import { applyDatabaseMigrations } from '../src/server/db';

let db: Client;

before(async () => {
  db = createClient({ url: 'file::memory:' });
  const legacySchema = [
    'CREATE TABLE applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)',
    'CREATE TABLE wallets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, balance REAL DEFAULT 0)',
    'CREATE TABLE payout_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)',
    'CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL)',
    'CREATE TABLE merchant_kyc (id TEXT PRIMARY KEY)',
    'CREATE TABLE payment_links (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, application_id TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, usage_count INTEGER DEFAULT 0, usage_limit INTEGER)',
    'CREATE TABLE payout_methods (id TEXT PRIMARY KEY)',
    'CREATE TABLE checkout_sessions (id TEXT PRIMARY KEY, payment_link_id TEXT, reference TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL)',
    'CREATE TABLE transactions (id TEXT PRIMARY KEY)',
    'CREATE TABLE api_credentials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, application_id TEXT NOT NULL, name TEXT NOT NULL, environment TEXT NOT NULL, prefix TEXT NOT NULL, secret_key TEXT NOT NULL, secret_masked TEXT NOT NULL, scope TEXT DEFAULT \'both\', is_active INTEGER DEFAULT 1, last_used_at TEXT, created_at TEXT NOT NULL)',
    'CREATE TABLE webhook_logs (id TEXT PRIMARY KEY)',
  ];

  for (const sql of legacySchema) await db.execute(sql);
  await db.execute({
    sql: 'INSERT INTO applications (id, user_id) VALUES (?, ?), (?, ?), (?, ?)',
    args: ['app_single', 'user_single', 'app_first', 'user_multiple', 'app_second', 'user_multiple'],
  });
  await db.execute({
    sql: 'INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, ?), (?, ?, ?)',
    args: ['wallet_single', 'user_single', 1500, 'wallet_multiple', 'user_multiple', 2300],
  });
  await db.execute({
    sql: 'INSERT INTO payout_requests (id, user_id) VALUES (?, ?), (?, ?)',
    args: ['payout_single', 'user_single', 'payout_multiple', 'user_multiple'],
  });
  await db.execute({
    sql: 'INSERT INTO payment_links (id, user_id, application_id, slug, title, usage_count, usage_limit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: ['legacy_link', 'user_single', 'app_single', 'legacy-product', 'Existing link', 2, 8],
  });
  await db.execute({
    sql: 'INSERT INTO checkout_sessions (id, payment_link_id, reference, amount, created_at) VALUES (?, ?, ?, ?, ?)',
    args: ['legacy_checkout', 'legacy_link', 'LEGACY-REF', 1250, '2025-01-01T00:00:00.000Z'],
  });
  await db.execute({
    sql: `INSERT INTO api_credentials
          (id, user_id, application_id, name, environment, prefix, secret_key, secret_masked, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['legacy_key', 'user_single', 'app_single', 'Existing key', 'sandbox', 'sk_test_existing', 'legacy-secret-value', 'sk_test_existing...abcd', '2025-01-01T00:00:00.000Z'],
  });
});

after(async () => {
  await db.close();
});

test('additive migrations are repeatable and preserve existing resource data', async () => {
  await applyDatabaseMigrations(db);
  await applyDatabaseMigrations(db);

  const migrations = await db.execute('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(migrations.rows.map((row) => Number(row.version)), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const link = await db.execute({
    sql: 'SELECT id, title, usage_count, usage_limit FROM payment_links WHERE id = ?',
    args: ['legacy_link'],
  });
  assert.deepEqual(
    {
      id: link.rows[0].id,
      title: link.rows[0].title,
      usageCount: Number(link.rows[0].usage_count),
      usageLimit: Number(link.rows[0].usage_limit),
    },
    { id: 'legacy_link', title: 'Existing link', usageCount: 2, usageLimit: 8 },
  );

  const key = await db.execute({
    sql: 'SELECT id, prefix, secret_key, secret_hash FROM api_credentials WHERE id = ?',
    args: ['legacy_key'],
  });
  assert.deepEqual(
    key.rows[0],
    {
      id: 'legacy_key',
      prefix: 'sk_test_existing',
      secret_key: '',
      secret_hash: crypto.createHash('sha256').update('legacy-secret-value').digest('hex'),
    },
  );

  const walletRows = await db.execute('SELECT id, application_id FROM wallets ORDER BY id');
  assert.deepEqual(
    walletRows.rows.map((row) => [row.id, row.application_id]),
    [['wallet_multiple', null], ['wallet_single', 'app_single']],
  );
  const payoutRows = await db.execute('SELECT id, application_id FROM payout_requests ORDER BY id');
  assert.deepEqual(
    payoutRows.rows.map((row) => [row.id, row.application_id]),
    [['payout_multiple', null], ['payout_single', 'app_single']],
  );

  const columns = await db.execute('PRAGMA table_info(api_credentials)');
  assert.ok(columns.rows.some((row) => row.name === 'secret_hash'));
  const paymentLinkColumns = await db.execute('PRAGMA table_info(payment_links)');
  assert.ok(paymentLinkColumns.rows.some((row) => row.name === 'expires_at'));

  const legacyCheckout = await db.execute({
    sql: 'SELECT user_id, application_id, reference FROM checkout_sessions WHERE id = ?',
    args: ['legacy_checkout'],
  });
  assert.deepEqual(legacyCheckout.rows[0], {
    user_id: 'user_single',
    application_id: 'app_single',
    reference: 'LEGACY-REF',
  });
});
