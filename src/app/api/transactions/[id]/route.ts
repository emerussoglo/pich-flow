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
    const { searchParams } = new URL(request.url);
    const applicationId = (searchParams.get('applicationId') || searchParams.get('appId') || '').trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'Application requise.' }, { status: 400 });
    }

    const db = getDb();
    const application = await db.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId, user.id],
    });
    if (application.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [id, user.id, applicationId],
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
      provider: String(row.provider || '').toLowerCase() === 'paydunya' ? 'PayDunya' : 'Historique',
      amount: Number(row.amount),
      providerFee: Number(row.provider_fee || 0),
      platformFee: Number(row.platform_fee || 0),
      customerFee: Number(row.customer_fee || 0),
      netAmount: Number(row.net_amount || row.amount),
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
