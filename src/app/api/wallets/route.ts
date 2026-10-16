import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM wallets WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
      args: [user.id],
    });

    // If user has zero wallets, initialize default XOF wallet
    if (result.rows.length === 0) {
      const now = new Date().toISOString();
      const defaultId = `wal_xof_${Date.now()}`;
      await db.execute({
        sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
              VALUES (?, ?, 'XOF', 'FCFA', 0, 0, 0, ?, 1, ?, ?)`,
        args: [defaultId, user.id, user.country || 'BJ', now, now],
      });

      return NextResponse.json({
        success: true,
        wallets: [
          {
            id: defaultId,
            currency: 'XOF',
            symbol: 'FCFA',
            balance: 0,
            pendingBalance: 0,
            reservedBalance: 0,
            countryCode: user.country || 'BJ',
            isDefault: true,
          },
        ],
      });
    }

    const wallets = result.rows.map((row) => ({
      id: String(row.id),
      currency: String(row.currency),
      symbol: String(row.symbol || row.currency),
      balance: Number(row.balance),
      pendingBalance: Number(row.pending_balance || 0),
      reservedBalance: Number(row.reserved_balance || 0),
      countryCode: String(row.country_code || 'BJ'),
      isDefault: Boolean(row.is_default),
    }));

    return NextResponse.json({ success: true, wallets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { countryCode, currency, symbol } = body;
    if (!countryCode || !currency) {
      return NextResponse.json({ success: false, error: 'Code pays et devise requis.' }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM wallets WHERE user_id = ? AND currency = ? AND country_code = ?',
      args: [user.id, currency, countryCode],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Un wallet pour ce pays et cette devise existe déjà.' }, { status: 400 });
    }

    const id = `wal_${currency.toLowerCase()}_${Date.now()}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0, ?, ?)`,
      args: [id, user.id, currency, symbol || currency, countryCode, now, now],
    });

    return NextResponse.json({
      success: true,
      wallet: {
        id,
        currency,
        symbol: symbol || currency,
        balance: 0,
        pendingBalance: 0,
        reservedBalance: 0,
        countryCode,
        isDefault: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

