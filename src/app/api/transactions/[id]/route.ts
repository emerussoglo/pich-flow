import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

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
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, user.activeApplicationId || ''],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Transaction introuvable.' }, { status: 404 });
    }

    const row = result.rows[0];
    const transaction = {
      id: String(row.id),
      reference: String(row.reference),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ''),
      country: String(row.country || 'BJ'),
      provider: String(row.provider || 'PayDunya'),
      amount: Number(row.amount),
      providerFee: Number(row.fees_confirmed) === 1 ? Number(row.provider_fee || 0) : null,
      platformFee: Number(row.platform_fee || 0),
      customerFee: Number(row.customer_fee || 0),
      netAmount: Number(row.fees_confirmed) === 1 ? Number(row.net_amount) : null,
      feesConfirmed: Number(row.fees_confirmed) === 1,
      currency: String(row.currency || 'XOF'),
      status: String(row.status),
      paymentMethod: String(row.payment_method || 'Mobile Money'),
      createdAt: String(row.created_at),
    };

    return NextResponse.json({ success: true, transaction });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
