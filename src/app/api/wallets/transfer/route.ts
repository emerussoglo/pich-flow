import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
  }
  const { applicationId, fromWalletId, toWalletId, amount } = body as Record<string, unknown>;
  const numericAmount = Number(amount);
  if (typeof applicationId !== 'string' || !applicationId.trim() ||
      typeof fromWalletId !== 'string' || !fromWalletId ||
      typeof toWalletId !== 'string' || !toWalletId ||
      fromWalletId === toWalletId ||
      !Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ success: false, error: 'Application, portefeuilles distincts et montant entier positif requis.' }, { status: 400 });
  }

  const db = getDb();
  const tx = await db.transaction('write');
  try {
    const app = await tx.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId, user.id],
    });
    if (app.rows.length === 0) {
      await tx.rollback();
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const source = await tx.execute({
      sql: `SELECT id, currency, balance FROM wallets
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [fromWalletId, user.id, applicationId],
    });
    const destination = await tx.execute({
      sql: `SELECT id, currency FROM wallets
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [toWalletId, user.id, applicationId],
    });
    if (source.rows.length === 0 || destination.rows.length === 0) {
      await tx.rollback();
      return NextResponse.json({ success: false, error: 'Portefeuille introuvable pour cette application.' }, { status: 404 });
    }
    if (String(source.rows[0].currency) !== String(destination.rows[0].currency)) {
      await tx.rollback();
      return NextResponse.json({ success: false, error: 'Le transfert entre devises différentes n’est pas pris en charge.' }, { status: 400 });
    }
    if (Number(source.rows[0].balance) < numericAmount) {
      await tx.rollback();
      return NextResponse.json({ success: false, error: 'Solde disponible insuffisant.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const debit = await tx.execute({
      sql: `UPDATE wallets SET balance = balance - ?, updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ? AND balance >= ?`,
      args: [numericAmount, now, fromWalletId, user.id, applicationId, numericAmount],
    });
    if (debit.rowsAffected !== 1) {
      await tx.rollback();
      return NextResponse.json({ success: false, error: 'Solde disponible insuffisant.' }, { status: 409 });
    }
    await tx.execute({
      sql: `UPDATE wallets SET balance = balance + ?, updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [numericAmount, now, toWalletId, user.id, applicationId],
    });
    await tx.commit();
    return NextResponse.json({
      success: true,
      message: 'Transfert effectué avec succès.',
      reference: `TRF-PF-${crypto.randomUUID()}`,
    });
  } catch (error) {
    await tx.rollback();
    const message = error instanceof Error ? error.message : 'Échec du transfert.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
