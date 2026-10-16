import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

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

    const { fromWalletId, toWalletId, amount } = body;
    const numAmount = Number(amount);
    if (!fromWalletId || !toWalletId || !amount || numAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Comptes source, destination et montant valide requis.' }, { status: 400 });
    }

    if (fromWalletId === toWalletId) {
      return NextResponse.json({ success: false, error: 'Les portefeuilles source et destination doivent être distincts.' }, { status: 400 });
    }

    const db = getDb();
    const sourceRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE id = ? AND user_id = ?',
      args: [fromWalletId, user.id],
    });

    if (sourceRes.rows.length === 0 || Number(sourceRes.rows[0].balance) < numAmount) {
      return NextResponse.json({ success: false, error: 'Solde insuffisant sur le portefeuille source.' }, { status: 400 });
    }

    const destRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE id = ? AND user_id = ?',
      args: [toWalletId, user.id],
    });

    if (destRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Portefeuille destination introuvable.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const ref = `TRF-PF-${Date.now().toString().slice(-6)}`;

    // Debit source
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?',
      args: [numAmount, now, fromWalletId],
    });

    // Credit destination
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE id = ?',
      args: [numAmount, now, toWalletId],
    });

    return NextResponse.json({
      success: true,
      message: 'Transfert effectué avec succès.',
      reference: ref,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

