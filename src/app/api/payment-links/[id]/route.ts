import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_PAYMENT_CURRENCIES } from '@/src/config/countries';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();
    const linkRes = await db.execute({
      sql: 'SELECT * FROM payment_links WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
    });

    if (linkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }

    const pl = linkRes.rows[0];

    const txsRes = await db.execute({
      sql: `SELECT * FROM transactions WHERE user_id = ? AND application_id = ? AND reference IN (
        SELECT reference FROM checkout_sessions WHERE payment_link_id = ?
      ) ORDER BY created_at DESC`,
      args: [user.id, applicationId, id],
    });

    const totalCount = txsRes.rows.length;
    const successCount = txsRes.rows.filter((t) => t.status === 'success').length;
    const failedCount = txsRes.rows.filter((t) => t.status === 'failed').length;
    const collectedAmount = txsRes.rows
      .filter((t) => t.status === 'success')
      .reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: String(pl.id),
        slug: String(pl.slug),
        title: String(pl.title),
        description: String(pl.description || ''),
        amount: pl.amount !== null ? Number(pl.amount) : null,
        minAmount: pl.amount_min !== null ? Number(pl.amount_min) : null,
        maxAmount: pl.amount_max !== null ? Number(pl.amount_max) : null,
        isFixedAmount: Boolean(pl.is_fixed_amount),
        currency: String(pl.currency || 'XOF'),
        country: String(pl.country || 'BJ'),
        status: String(pl.status),
        usageCount: Number(pl.usage_count || 0),
        createdAt: String(pl.created_at),
        stats: {
          totalTransactions: totalCount,
          successCount,
          failedCount,
          collectedAmount,
        },
        transactions: txsRes.rows.map((r) => ({
          id: String(r.id),
          reference: String(r.reference),
          customerName: String(r.customer_name),
          customerPhone: String(r.customer_phone || ''),
          amount: Number(r.amount),
          currency: String(r.currency || 'XOF'),
          status: String(r.status),
          createdAt: String(r.created_at),
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { title, description, amount, minAmount, maxAmount, isFixedAmount, status } = body;
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT is_fixed_amount, currency, amount_min, amount_max FROM payment_links WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    const currentLink = existing.rows[0];
    const currency = String(currentLink.currency || 'XOF');
    const minimumAmount = SUPPORTED_PAYMENT_CURRENCIES.find((supported) => supported.code === currency)?.minimumAmount || 1;
    const fixedAmount = isFixedAmount === undefined ? Boolean(currentLink.is_fixed_amount) : isFixedAmount === true;
    if (fixedAmount && amount !== undefined && (!Number.isSafeInteger(Number(amount)) || Number(amount) < minimumAmount)) {
      return NextResponse.json({
        success: false,
        error: `Le montant du lien doit être un entier d’au moins ${minimumAmount} ${currency}.`,
      }, { status: 400 });
    }
    const nextMinimum = minAmount === undefined ? Number(currentLink.amount_min) : Number(minAmount);
    const nextMaximum = maxAmount === undefined ? Number(currentLink.amount_max) : Number(maxAmount);
    if (!fixedAmount && (
      !Number.isSafeInteger(nextMinimum) ||
      !Number.isSafeInteger(nextMaximum) ||
      nextMinimum < minimumAmount ||
      nextMaximum < nextMinimum
    )) {
      return NextResponse.json({
        success: false,
        error: `Définissez une fourchette entière comprise entre ${minimumAmount} et un maximum supérieur ou égal, en ${currency}.`,
      }, { status: 400 });
    }

    await db.execute({
      sql: `UPDATE payment_links SET 
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            amount = COALESCE(?, amount),
            is_fixed_amount = COALESCE(?, is_fixed_amount),
            amount_min = ?,
            amount_max = ?,
            status = COALESCE(?, status),
            updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [
        title,
        description,
        amount !== undefined ? amount : null,
        isFixedAmount !== undefined ? (isFixedAmount ? 1 : 0) : null,
        fixedAmount ? null : nextMinimum,
        fixedAmount ? null : nextMaximum,
        status,
        new Date().toISOString(),
        id,
        user.id,
        applicationId,
      ],
    });

    return NextResponse.json({ success: true, message: 'Lien de paiement mis à jour.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM payment_links WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
    });

    return NextResponse.json({ success: true, message: 'Lien de paiement supprimé.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
