import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

async function ownedApplication(applicationId: string, userId: string) {
  return getDb().execute({
    sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
    args: [applicationId, userId],
  });
}

async function ensureAppWallet(applicationId: string, userId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR IGNORE INTO wallets
      (id, user_id, application_id, currency, symbol, balance, pending_balance,
       reserved_balance, country_code, is_default, created_at, updated_at)
      VALUES (?, ?, ?, 'XOF', 'FCFA', 0, 0, 0, ?, 1, ?, ?)`,
    args: [`wal_${applicationId}_xof`, userId, applicationId, 'BJ', now, now],
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });

    const applicationId = request.nextUrl.searchParams.get('applicationId')?.trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    const app = await ownedApplication(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    await ensureAppWallet(applicationId, user.id);
    const result = await getDb().execute({
      sql: `SELECT id, currency, symbol, balance, pending_balance, reserved_balance,
                   country_code, is_default
            FROM wallets WHERE user_id = ? AND application_id = ?
            ORDER BY is_default DESC, created_at ASC`,
      args: [user.id, applicationId],
    });
    const wallets = result.rows.map((row) => ({
      id: String(row.id),
      currency: String(row.currency),
      symbol: String(row.symbol || row.currency),
      balance: Number(row.balance),
      pendingBalance: Number(row.pending_balance || 0),
      reservedBalance: Number(row.reserved_balance || 0),
      countryCode: String(row.country_code || user.country || 'BJ'),
      isDefault: Boolean(row.is_default),
    }));
    return NextResponse.json({ success: true, wallets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger le portefeuille.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const { applicationId, countryCode, currency } = body as Record<string, unknown>;
    if (typeof applicationId !== 'string' || !applicationId.trim() ||
        countryCode !== 'BJ' ||
        currency !== 'XOF') {
      return NextResponse.json({
        success: false,
        error: 'applicationId, pays BJ et devise XOF requis.',
      }, { status: 400 });
    }

    const app = await ownedApplication(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const id = `wal_${applicationId}_xof`;
    await db.execute({
      sql: `INSERT OR IGNORE INTO wallets
        (id, user_id, application_id, currency, symbol, balance, pending_balance,
         reserved_balance, country_code, is_default, created_at, updated_at)
        VALUES (?, ?, ?, 'XOF', 'FCFA', 0, 0, 0, ?, 0, ?, ?)`,
      args: [id, user.id, applicationId, countryCode, now, now],
    });
    const result = await db.execute({
      sql: `SELECT id, currency, symbol, balance, pending_balance, reserved_balance,
                   country_code, is_default
            FROM wallets WHERE user_id = ? AND application_id = ? AND currency = 'XOF'`,
      args: [user.id, applicationId],
    });
    const row = result.rows[0];
    if (!row) throw new Error('The application wallet could not be created.');
    return NextResponse.json({
      success: true,
      wallet: {
        id: String(row.id),
        currency: String(row.currency),
        symbol: String(row.symbol || row.currency),
        balance: Number(row.balance),
        pendingBalance: Number(row.pending_balance || 0),
        reservedBalance: Number(row.reserved_balance || 0),
        countryCode: String(row.country_code || countryCode),
        isDefault: Boolean(row.is_default),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de créer le portefeuille.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
