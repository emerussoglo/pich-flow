import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let dbClient: Client | null = null;

export function getDb(): Client {
  if (dbClient) return dbClient;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (isProduction && (!url || !authToken)) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured in production.');
  }

  try {
    dbClient = createClient({
      url: url || 'file:local.db',
      authToken: authToken || undefined,
    });
    return dbClient;
  } catch (err) {
    if (isProduction) {
      throw err;
    }
    console.warn('[DB] Fallback to local SQLite file due to error:', err);
    dbClient = createClient({
      url: 'file:local.db',
    });
    return dbClient;
  }
}

export async function initDatabase(database: Client = getDb()): Promise<void> {
  const db = database;
  console.log('[DB] Initializing database tables...');

  // 1. Users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      role TEXT DEFAULT 'merchant',
      is_verified INTEGER DEFAULT 1,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 2. User sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Applications
  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT DEFAULT 'E-commerce',
      website TEXT DEFAULT '',
      environment TEXT DEFAULT 'test',
      currency TEXT DEFAULT 'XOF',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 4. Merchant KYC
  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_kyc (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      account_type TEXT DEFAULT 'individual',
      company_name TEXT,
      rccm_number TEXT,
      ifu_number TEXT,
      full_name TEXT,
      nationality TEXT DEFAULT 'Bénin',
      id_type TEXT DEFAULT 'cip',
      id_number TEXT,
      address TEXT,
      status TEXT DEFAULT 'verified',
      compliance_level TEXT DEFAULT 'Niveau 2 - Standard',
      notes TEXT,
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 5. KYC Documents
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id TEXT PRIMARY KEY,
      kyc_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 6. Wallets
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT,
      currency TEXT NOT NULL,
      symbol TEXT NOT NULL,
      balance REAL DEFAULT 0,
      pending_balance REAL DEFAULT 0,
      reserved_balance REAL DEFAULT 0,
      country_code TEXT DEFAULT 'BJ',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 7. API Credentials (Single Secret Key per environment)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      name TEXT NOT NULL,
      environment TEXT NOT NULL,
      prefix TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      secret_masked TEXT NOT NULL,
      scope TEXT DEFAULT 'both',
      is_active INTEGER DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 8. Transactions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      external_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      provider TEXT NOT NULL,
      amount REAL NOT NULL,
      provider_fee REAL DEFAULT 0,
      platform_fee REAL DEFAULT 0,
      customer_fee REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      status TEXT DEFAULT 'pending',
      description TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'Mobile Money',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 9. Payment Links
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      amount REAL,
      is_fixed_amount INTEGER DEFAULT 1,
      currency TEXT DEFAULT 'XOF',
      country TEXT DEFAULT 'BJ',
      status TEXT DEFAULT 'active',
      usage_count INTEGER DEFAULT 0,
      usage_limit INTEGER,
      require_phone INTEGER DEFAULT 1,
      redirect_url TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 10. Customers
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      payment_count INTEGER DEFAULT 1,
      total_spent REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      last_transaction_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 11. Payout Methods
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payout_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      operator_or_bank TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone_or_iban TEXT NOT NULL,
      country TEXT DEFAULT 'BJ',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 12. Payout Requests / Withdrawals
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT,
      reference TEXT UNIQUE NOT NULL,
      external_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      fee REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      method_type TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone_or_iban TEXT NOT NULL,
      operator_or_bank TEXT NOT NULL,
      country TEXT DEFAULT 'BJ',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 13. Webhooks
  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      secret TEXT NOT NULL,
      events TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_delivery_status TEXT DEFAULT 'success',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 14. Webhook Logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      status_code INTEGER DEFAULT 200,
      response_body TEXT,
      success INTEGER DEFAULT 1,
      attempts INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 15. IP Whitelist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 16. Audit Logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 17. Checkout Sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id TEXT PRIMARY KEY,
      payment_link_id TEXT,
      application_id TEXT,
      reference TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      paydunya_token TEXT,
      paydunya_url TEXT,
      payment_method TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 18. Email Verification Codes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkout_idempotency (
      application_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      reference TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (application_id, idempotency_key)
    )
  `);

  await applyDatabaseMigrations(db);

  console.log('[DB] All tables verified successfully.');
}

const DATABASE_MIGRATIONS = [
  {
    version: 1,
    name: 'additive-columns-for-existing-resources',
    columns: [
      ['merchant_kyc', 'first_name', 'TEXT'],
      ['merchant_kyc', 'last_name', 'TEXT'],
      ['merchant_kyc', 'birth_date', 'TEXT'],
      ['merchant_kyc', 'recto_url', 'TEXT'],
      ['merchant_kyc', 'verso_url', 'TEXT'],
      ['merchant_kyc', 'selfie_url', 'TEXT'],
      ['merchant_kyc', 'representative_name', 'TEXT'],
      ['merchant_kyc', 'rccm_doc_url', 'TEXT'],
      ['merchant_kyc', 'ifu_doc_url', 'TEXT'],
      ['payment_links', 'client_fee_enabled', 'INTEGER DEFAULT 0'],
      ['payment_links', 'fee_rate', 'REAL DEFAULT 0'],
      ['payout_methods', 'label', 'TEXT'],
      ['payout_methods', 'account_number', 'TEXT'],
      ['payout_methods', 'iban', 'TEXT'],
      ['payout_methods', 'swift_bic', 'TEXT'],
      ['payout_methods', 'bank_code', 'TEXT'],
      ['payout_methods', 'branch_code', 'TEXT'],
      ['payout_methods', 'currency', "TEXT DEFAULT 'XOF'"],
      ['checkout_sessions', 'user_id', 'TEXT'],
      ['checkout_sessions', 'saspay_session_id', 'TEXT'],
      ['checkout_sessions', 'saspay_checkout_url', 'TEXT'],
      ['checkout_sessions', 'idempotency_key', 'TEXT'],
      ['checkout_sessions', 'provider', "TEXT DEFAULT 'paydunya'"],
      ['transactions', 'idempotency_key', 'TEXT'],
      ['transactions', 'saspay_id', 'TEXT'],
      ['api_credentials', 'secret_hash', 'TEXT'],
      ['webhook_logs', 'external_event_id', 'TEXT'],
      ['webhook_logs', 'signature', 'TEXT'],
    ] as const,
  },
  {
    version: 2,
    name: 'scope-wallets-to-applications',
    columns: [
      ['wallets', 'application_id', 'TEXT'],
    ] as const,
  },
  {
    version: 3,
    name: 'record-payment-fee-confirmation',
    columns: [
      ['transactions', 'fees_confirmed', 'INTEGER NOT NULL DEFAULT 0'],
    ] as const,
  },
  {
    version: 4,
    name: 'bind-dashboard-session-to-active-application',
    columns: [
      ['sessions', 'application_id', 'TEXT'],
    ] as const,
  },
  {
    version: 5,
    name: 'hash-existing-api-credential-secrets',
    columns: [] as const,
  },
  {
    version: 6,
    name: 'attach-legacy-checkout-sessions-to-payment-links',
    columns: [
      ['checkout_sessions', 'application_id', 'TEXT'],
      ['checkout_sessions', 'payment_link_id', 'TEXT'],
    ] as const,
  },
  {
    version: 7,
    name: 'reattach-unambiguous-legacy-wallets',
    columns: [] as const,
  },
  {
    version: 8,
    name: 'scope-payout-requests-to-applications',
    columns: [
      ['payout_requests', 'application_id', 'TEXT'],
    ] as const,
  },
] as const;

export async function applyDatabaseMigrations(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  for (const migration of DATABASE_MIGRATIONS) {
    const applied = await db.execute({
      sql: 'SELECT version FROM schema_migrations WHERE version = ?',
      args: [migration.version],
    });
    if (applied.rows.length > 0) continue;

    for (const [table, column, definition] of migration.columns) {
      const info = await db.execute(`PRAGMA table_info(${table})`);
      if (!info.rows.some((row) => String(row.name) === column)) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }

    if (migration.version === 2) {
      await db.execute(`
        UPDATE wallets
        SET application_id = (
          SELECT MIN(applications.id)
          FROM applications
          WHERE applications.user_id = wallets.user_id
        )
        WHERE application_id IS NULL
          AND (SELECT COUNT(*) FROM applications WHERE applications.user_id = wallets.user_id) = 1
      `);
    }

    if (migration.version === 5) {
      const legacyKeys = await db.execute(
        `SELECT id, secret_key, secret_hash
         FROM api_credentials
         WHERE secret_key IS NOT NULL AND secret_key <> ''`,
      );
      for (const key of legacyKeys.rows) {
        const secret = String(key.secret_key);
        let hash = String(key.secret_hash || '');
        if (!hash) {
          const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
          hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        }
        await db.execute({
          sql: 'UPDATE api_credentials SET secret_hash = ?, secret_key = ? WHERE id = ?',
          args: [hash, '', String(key.id)],
        });
      }
    }

    if (migration.version === 6) {
      await db.execute(`
        UPDATE checkout_sessions
        SET user_id = COALESCE(user_id, (
              SELECT payment_links.user_id
              FROM payment_links
              WHERE payment_links.id = checkout_sessions.payment_link_id
            )),
            application_id = COALESCE(application_id, (
              SELECT payment_links.application_id
              FROM payment_links
              WHERE payment_links.id = checkout_sessions.payment_link_id
            ))
        WHERE payment_link_id IS NOT NULL
      `);
    }

    if (migration.version === 7) {
      await db.execute(`
        UPDATE wallets
        SET application_id = (
          SELECT MIN(applications.id)
          FROM applications
          WHERE applications.user_id = wallets.user_id
        )
        WHERE application_id IS NULL
          AND (SELECT COUNT(*) FROM applications WHERE applications.user_id = wallets.user_id) = 1
      `);
    }

    if (migration.version === 8) {
      await db.execute(`
        UPDATE payout_requests
        SET application_id = (
          SELECT MIN(applications.id)
          FROM applications
          WHERE applications.user_id = payout_requests.user_id
        )
        WHERE application_id IS NULL
          AND (SELECT COUNT(*) FROM applications WHERE applications.user_id = payout_requests.user_id) = 1
      `);
    }

    await db.execute({
      sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      args: [migration.version, migration.name, new Date().toISOString()],
    });
  }
}
