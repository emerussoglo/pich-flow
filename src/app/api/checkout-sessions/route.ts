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

    const db = getDb();
    let sql = 'SELECT * FROM checkout_sessions WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.execute({ sql, args });

    const checkoutSessions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ''),
      status: String(row.status),
      saspaySessionId: row.saspay_session_id ? String(row.saspay_session_id) : undefined,
      saspayCheckoutUrl: row.saspay_checkout_url ? String(row.saspay_checkout_url) : undefined,
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, checkoutSessions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

