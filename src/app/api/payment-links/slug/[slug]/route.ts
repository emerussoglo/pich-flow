import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT pl.*, u.full_name as merchant_name, a.name as app_name
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            LEFT JOIN applications a ON pl.application_id = a.id
            WHERE pl.slug = ?`,
      args: [slug],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }

    const row = result.rows[0];
    const paymentLink = {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ''),
      amount: row.amount !== null ? Number(row.amount) : undefined,
      currency: String(row.currency || 'XOF'),
      isFixedAmount: Boolean(row.is_fixed_amount),
      country: String(row.country || 'BJ'),
      redirectUrl: String(row.redirect_url || ''),
      isActive: Boolean(row.is_active),
      merchantName: String(row.app_name || row.merchant_name || 'PitchFlow Studios'),
    };

    return NextResponse.json({ success: true, paymentLink });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

