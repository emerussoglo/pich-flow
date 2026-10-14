import { getDb } from './db';
import crypto from 'crypto';

export async function seedInitialDataIfNeeded(): Promise<void> {
  const db = getDb();

  try {
    const userCheck = await db.execute('SELECT COUNT(*) as count FROM users');
    const userCount = Number(userCheck.rows[0].count || 0);

    if (userCount > 0) {
      console.log(`[DB] Database verified (${userCount} user(s) registered).`);
      return;
    }

    console.log('[DB] Seeding verified baseline merchant user (clean state, zero mock data)...');

    const defaultUserId = 'usr_merchant_default';
    const now = new Date().toISOString();
    // Default password hash for 'PichFlow2026!'
    const salt = 'pichflow_salt_2026';
    const passwordHash = crypto.pbkdf2Sync('PichFlow2026!', salt, 1000, 64, 'sha512').toString('hex');

    // Insert baseline merchant (is_verified = 1)
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, full_name, phone, country, role, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        defaultUserId,
        'merchant@pichflow.com',
        passwordHash,
        'Yannick Sossou',
        '+229 97 00 12 34',
        'BJ',
        'merchant',
        1,
        now,
        now,
      ],
    });

    // Zero-balance primary wallet (strictly 0 XOF)
    await db.execute({
      sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 'BJ', 1, ?, ?)`,
      args: ['wal_xof_default', defaultUserId, 'XOF', 'FCFA', now, now],
    });

    console.log('[DB] Baseline merchant seeded with 0 balance and 0 mock applications.');
  } catch (err) {
    console.error('[DB] Seeding error:', err);
  }
}

// Controlled purge of initial demonstration fixtures to leave space completely pristine
export async function purgeMockDataForUser(userId: string): Promise<void> {
  const db = getDb();
  try {
    await db.execute({ sql: 'DELETE FROM applications WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM transactions WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM payment_links WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM payout_methods WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM payout_requests WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM api_credentials WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM webhooks WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM customers WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM merchant_kyc WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'UPDATE wallets SET balance = 0, pending_balance = 0, reserved_balance = 0 WHERE user_id = ?', args: [userId] });
    console.log(`[DB] Mock fixtures cleaned for user ${userId}.`);
  } catch (err) {
    console.error('[DB] Purge error:', err);
  }
}
