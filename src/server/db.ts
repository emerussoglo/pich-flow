import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let dbClient: Client | null = null;
let databaseInitPromise: Promise<void> | null = null;

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

export async function migratePaymentLinksUsageLimit(db: Client = getDb()): Promise<void> {
  const columns = await db.execute('PRAGMA table_info(payment_links)');
  const columnNames = new Set(columns.rows.map((column) => String(column.name)));

  if (!columnNames.has('usage_limit')) {
    await db.execute('ALTER TABLE payment_links ADD COLUMN usage_limit INTEGER');
  }
  if (columnNames.has('max_payments')) {
    await db.execute(`UPDATE payment_links
                      SET usage_limit = max_payments
                      WHERE usage_limit IS NULL AND max_payments IS NOT NULL`);
  }
}

export async function initDatabase(): Promise<void> {
  const db = getDb();
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

  // Additive migrations: inspect each table so real schema errors are not hidden.
  const ensureColumn = async (table: string, column: string, definition: string) => {
    const columns = await db.execute(`PRAGMA table_info("${table}")`);
    if (columns.rows.some((row) => String(row.name) === column)) return;
    await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  };

  await ensureColumn('merchant_kyc', 'first_name', 'TEXT');
  await ensureColumn('merchant_kyc', 'last_name', 'TEXT');
  await ensureColumn('merchant_kyc', 'birth_date', 'TEXT');
  await ensureColumn('merchant_kyc', 'recto_url', 'TEXT');
  await ensureColumn('merchant_kyc', 'verso_url', 'TEXT');
  await ensureColumn('merchant_kyc', 'selfie_url', 'TEXT');
  await ensureColumn('merchant_kyc', 'representative_name', 'TEXT');
  await ensureColumn('merchant_kyc', 'rccm_doc_url', 'TEXT');
  await ensureColumn('merchant_kyc', 'ifu_doc_url', 'TEXT');
  await ensureColumn('payment_links', 'client_fee_enabled', 'INTEGER DEFAULT 0');
  await ensureColumn('payment_links', 'fee_rate', 'REAL DEFAULT 0');
  await migratePaymentLinksUsageLimit(db);
  await ensureColumn('payout_methods', 'label', 'TEXT');
  await ensureColumn('payout_methods', 'account_number', 'TEXT');
  await ensureColumn('payout_methods', 'iban', 'TEXT');
  await ensureColumn('payout_methods', 'swift_bic', 'TEXT');
  await ensureColumn('payout_methods', 'bank_code', 'TEXT');
  await ensureColumn('payout_methods', 'branch_code', 'TEXT');
  await ensureColumn('payout_methods', 'currency', "TEXT DEFAULT 'XOF'");
  await ensureColumn('checkout_sessions', 'user_id', 'TEXT');
  await ensureColumn('checkout_sessions', 'saspay_session_id', 'TEXT');
  await ensureColumn('checkout_sessions', 'saspay_checkout_url', 'TEXT');
  await ensureColumn('checkout_sessions', 'idempotency_key', 'TEXT');
  await ensureColumn('checkout_sessions', 'provider', "TEXT DEFAULT 'paydunya'");
  await ensureColumn('transactions', 'idempotency_key', 'TEXT');
  await ensureColumn('transactions', 'saspay_id', 'TEXT');
  await ensureColumn('wallets', 'application_id', 'TEXT');
  await ensureColumn('payout_requests', 'application_id', 'TEXT');
  await ensureColumn('api_credentials', 'secret_hash', 'TEXT');
  await ensureColumn('webhook_logs', 'external_event_id', 'TEXT');
  await ensureColumn('webhook_logs', 'signature', 'TEXT');
  await ensureColumn('customers', 'updated_at', 'TEXT');
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_app_currency_unique
    ON wallets (user_id, application_id, currency) WHERE application_id IS NOT NULL`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_idempotency_unique
    ON checkout_sessions (idempotency_key)
    WHERE substr(idempotency_key, 1, 9) = 'paydunya:'`);

  console.log('[DB] All tables verified successfully.');
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (!databaseInitPromise) {
    databaseInitPromise = initDatabase().catch((error: unknown) => {
      databaseInitPromise = null;
      throw error;
    });
  }
  await databaseInitPromise;
}
