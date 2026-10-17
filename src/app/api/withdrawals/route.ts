import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

async function getOwnedApplication(applicationId: string, userId: string) {
  return getDb().execute({
    sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
    args: [applicationId, userId],
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
    const app = await getOwnedApplication(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const result = await getDb().execute({
      sql: `SELECT id, reference, amount, currency, fee, net_amount, method_type,
                   recipient_name, recipient_phone_or_iban, operator_or_bank, country,
                   status, created_at, processed_at
            FROM payout_requests
            WHERE user_id = ? AND application_id = ?
            ORDER BY created_at DESC`,
      args: [user.id, applicationId],
    });
    const withdrawals = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      fee: Number(row.fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      methodType: String(row.method_type) as 'mobile_money' | 'bank_transfer',
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      operatorOrBank: String(row.operator_or_bank),
      country: String(row.country || 'BJ'),
      status: String(row.status),
      createdAt: String(row.created_at),
      processedAt: row.processed_at ? String(row.processed_at) : undefined,
    }));
    return NextResponse.json({ success: true, withdrawals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les retraits.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
  }
  const applicationId = (body as Record<string, unknown>).applicationId;
  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
  }
  const app = await getOwnedApplication(applicationId, user.id);
  if (app.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
  }

  return NextResponse.json({
    success: false,
    error: 'Les retraits PayDunya ne sont pas activés pour ce compte. Aucun solde n’a été débité.',
  }, { status: 501 });
}
