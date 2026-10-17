import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';
import { getDb } from '@/src/server/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM payout_requests WHERE user_id = ? AND application_id = ? ORDER BY created_at DESC',
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
  }
  return NextResponse.json(
    { success: false, error: 'Les retraits ne sont pas encore intégrés à un prestataire de paiement.' },
    { status: 501 },
  );
}
