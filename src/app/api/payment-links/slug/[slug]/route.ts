import { NextRequest, NextResponse } from 'next/server';
import { ensureDatabaseInitialized, getDb } from '@/src/server/db';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    await ensureDatabaseInitialized();
    const { slug } = await context.params;
    const result = await getDb().execute({
      sql: `SELECT pl.id, pl.slug, pl.title, pl.description, pl.amount,
                   pl.is_fixed_amount, pl.currency, pl.country, pl.status,
                   pl.require_phone, pl.usage_count, pl.usage_limit, a.name AS app_name
            FROM payment_links pl
            JOIN applications a ON a.id = pl.application_id AND a.user_id = pl.user_id
            WHERE pl.slug = ? AND pl.status = 'active'
            LIMIT 1`,
      args: [slug],
    });
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ success: false, error: 'Lien de paiement introuvable.' }, { status: 404 });
    }
    if (row.usage_limit !== null && Number(row.usage_count) >= Number(row.usage_limit)) {
      return NextResponse.json({ success: false, error: 'Ce lien a atteint sa limite d’utilisation.' }, { status: 410 });
    }
    if (String(row.currency).toUpperCase() !== 'XOF') {
      return NextResponse.json({ success: false, error: 'Devise non prise en charge.' }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        description: String(row.description || ''),
        amount: row.amount === null ? undefined : Number(row.amount),
        currency: 'XOF',
        isFixedAmount: Boolean(row.is_fixed_amount),
        country: String(row.country || 'BJ'),
        isActive: true,
        requirePhone: true,
        merchantName: String(row.app_name || 'Pitchflow'),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger le lien de paiement.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
