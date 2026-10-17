import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

function applicationIdFromRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get('applicationId')?.trim() || '';
}

async function getOwnedLink(id: string, userId: string, applicationId: string) {
  return getDb().execute({
    sql: `SELECT * FROM payment_links
          WHERE id = ? AND user_id = ? AND application_id = ? LIMIT 1`,
    args: [id, userId, applicationId],
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    const applicationId = applicationIdFromRequest(request);
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    const { id } = await context.params;
    const db = getDb();
    const linkResult = await getOwnedLink(id, user.id, applicationId);
    if (linkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    const link = linkResult.rows[0];
    const txResult = await db.execute({
      sql: `SELECT t.id, t.reference, t.customer_name, t.customer_phone, t.amount,
                   t.currency, t.status, t.created_at, t.application_id
            FROM transactions t
            JOIN checkout_sessions cs ON cs.reference = t.reference
            WHERE t.user_id = ? AND t.application_id = ? AND cs.payment_link_id = ?
            ORDER BY t.created_at DESC`,
      args: [user.id, applicationId, id],
    });
    const transactions = txResult.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      customerName: String(row.customer_name),
      customerPhone: String(row.customer_phone || ''),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      status: String(row.status),
      createdAt: String(row.created_at),
    }));
    return NextResponse.json({
      success: true,
      paymentLink: {
        id: String(link.id),
        slug: String(link.slug),
        title: String(link.title),
        description: String(link.description || ''),
        amount: link.amount === null ? null : Number(link.amount),
        isFixedAmount: Boolean(link.is_fixed_amount),
        currency: String(link.currency || 'XOF'),
        country: String(link.country || 'BJ'),
        status: String(link.status),
        usageCount: Number(link.usage_count || 0),
        usageLimit: link.usage_limit === null ? null : Number(link.usage_limit),
        createdAt: String(link.created_at),
        stats: {
          totalTransactions: transactions.length,
          successCount: transactions.filter((item) => item.status === 'success').length,
          failedCount: transactions.filter((item) => item.status === 'failed').length,
          collectedAmount: transactions
            .filter((item) => item.status === 'success')
            .reduce((sum, item) => sum + item.amount, 0),
        },
        transactions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger le lien.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    const applicationId = applicationIdFromRequest(request);
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    const { id } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const title = values.title;
    const description = values.description;
    const amount = values.amount;
    const isFixedAmount = values.isFixedAmount;
    const usageLimit = Object.hasOwn(values, 'usageLimit') ? values.usageLimit : values.maxPayments;
    const status = values.status;
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 160)) {
      return NextResponse.json({ success: false, error: 'Titre invalide.' }, { status: 400 });
    }
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      return NextResponse.json({ success: false, error: 'Statut de lien invalide.' }, { status: 400 });
    }
    if (isFixedAmount === true && (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0)) {
      return NextResponse.json({ success: false, error: 'Un montant fixe entier positif en XOF est requis.' }, { status: 400 });
    }
    if (usageLimit !== undefined && usageLimit !== null &&
        (!Number.isSafeInteger(Number(usageLimit)) || Number(usageLimit) <= 0)) {
      return NextResponse.json({ success: false, error: 'La limite d’utilisation doit être un entier positif.' }, { status: 400 });
    }

    const db = getDb();
    const owned = await getOwnedLink(id, user.id, applicationId);
    if (owned.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    if (usageLimit !== undefined && usageLimit !== null &&
        Number(usageLimit) < Number(owned.rows[0].usage_count || 0)) {
      return NextResponse.json({ success: false, error: 'La limite ne peut pas être inférieure aux utilisations déjà réservées.' }, { status: 409 });
    }
    const result = await db.execute({
      sql: `UPDATE payment_links SET
              title = COALESCE(?, title),
              description = COALESCE(?, description),
              amount = CASE WHEN ? = 0 THEN NULL ELSE COALESCE(?, amount) END,
              is_fixed_amount = COALESCE(?, is_fixed_amount),
              usage_limit = CASE WHEN ? = 1 THEN ? ELSE usage_limit END,
              status = COALESCE(?, status),
              updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [
        title === undefined ? null : title.trim(),
        description === undefined ? null : String(description).trim().slice(0, 1000),
        isFixedAmount === false ? 0 : 1,
        amount === undefined ? null : Number(amount),
        isFixedAmount === undefined ? null : isFixedAmount ? 1 : 0,
        usageLimit === undefined ? 0 : 1,
        usageLimit === null ? null : usageLimit === undefined ? null : Number(usageLimit),
        status === undefined ? null : status,
        new Date().toISOString(),
        id,
        user.id,
        applicationId,
      ],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Lien de paiement mis à jour.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de modifier le lien.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    const applicationId = applicationIdFromRequest(request);
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    const { id } = await context.params;
    const result = await getDb().execute({
      sql: `UPDATE payment_links SET status = 'inactive', updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ?`,
      args: [new Date().toISOString(), id, user.id, applicationId],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Lien de paiement désactivé.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de désactiver le lien.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
