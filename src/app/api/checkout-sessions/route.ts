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
    if (!applicationId.trim()) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }

    const db = getDb();
    const application = await db.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId.trim(), user.id],
    });
    if (!application.rows[0]) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const result = await db.execute({
      sql: `SELECT id, reference, amount, currency, customer_name, customer_email,
                   customer_phone, status, payment_method, paydunya_url, created_at
            FROM checkout_sessions
            WHERE user_id = ? AND application_id = ?
            ORDER BY created_at DESC`,
      args: [user.id, applicationId.trim()],
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
      paymentMethod: String(row.payment_method || 'PayDunya checkout'),
      paydunyaUrl: row.paydunya_url ? String(row.paydunya_url) : undefined,
      createdAt: String(row.created_at),
    }));

    return NextResponse.json({ success: true, checkoutSessions });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Impossible de charger les sessions de paiement.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
