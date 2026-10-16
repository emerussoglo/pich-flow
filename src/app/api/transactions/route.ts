import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    const status = searchParams.get('status') || '';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const db = getDb();
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    if (status.trim()) {
      sql += ' AND status = ?';
      args.push(status.trim());
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    const result = await db.execute({ sql, args });

    const transactions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ''),
      country: String(row.country || 'BJ'),
      provider: String(row.provider || 'saspay'),
      amount: Number(row.amount),
      providerFee: Number(row.provider_fee || 0),
      platformFee: Number(row.platform_fee || 0),
      customerFee: Number(row.customer_fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      currency: String(row.currency || 'XOF'),
      status: String(row.status),
      paymentMethod: String(row.payment_method || 'Mobile Money'),
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, transactions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

