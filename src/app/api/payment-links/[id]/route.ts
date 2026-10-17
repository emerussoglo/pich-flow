import { NextRequest, NextResponse } from 'next/server';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '@/src/config/payments';
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
    const { title, description, amount, isFixedAmount, status } = body;
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    if (amount !== undefined && (!Number.isSafeInteger(Number(amount)) || Number(amount) < PAYDUNYA_MINIMUM_AMOUNT_XOF)) {
      return NextResponse.json({
        success: false,
        error: `Le montant du lien doit être un entier d’au moins ${PAYDUNYA_MINIMUM_AMOUNT_XOF} XOF.`,
      }, { status: 400 });
    }

    const db = getDb();
    await db.execute({
      sql: `UPDATE payment_links SET 
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            amount = COALESCE(?, amount),
            is_fixed_amount = COALESCE(?, is_fixed_amount),
            status = COALESCE(?, status),
            updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [
        title,
        description,
        amount !== undefined ? amount : null,
        isFixedAmount !== undefined ? (isFixedAmount ? 1 : 0) : null,
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
