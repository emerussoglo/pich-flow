import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT cs.* FROM checkout_sessions cs
            LEFT JOIN payment_links pl ON pl.id = cs.payment_link_id
            WHERE cs.application_id = ?
              AND (cs.user_id = ? OR (pl.user_id = ? AND pl.application_id = ?))
            ORDER BY cs.created_at DESC`,
      args: [applicationId, user.id, user.id, applicationId],
    });

    const checkoutSessions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ''),
      status: String(row.status),
      paydunyaUrl: row.paydunya_url ? String(row.paydunya_url) : undefined,
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, checkoutSessions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
