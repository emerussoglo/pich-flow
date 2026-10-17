import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
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
      sql: `SELECT pl.*,
              (SELECT COUNT(*) FROM transactions t
               JOIN checkout_sessions cs ON cs.reference = t.reference
               WHERE cs.payment_link_id = pl.id AND t.user_id = pl.user_id
                 AND t.application_id = pl.application_id AND t.status = 'success') AS payment_count,
              (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
               JOIN checkout_sessions cs ON cs.reference = t.reference
               WHERE cs.payment_link_id = pl.id AND t.user_id = pl.user_id
                 AND t.application_id = pl.application_id AND t.status = 'success') AS total_collected
            FROM payment_links pl
            WHERE pl.user_id = ? AND pl.application_id = ?
            ORDER BY pl.created_at DESC`,
      args: [user.id, applicationId],
    });
    const paymentLinks = result.rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ''),
      amount: row.amount === null ? undefined : Number(row.amount),
      currency: String(row.currency || 'XOF'),
      isFixedAmount: Boolean(row.is_fixed_amount),
      country: String(row.country || 'BJ'),
      redirectUrl: String(row.redirect_url || ''),
      usageLimit: row.usage_limit === null ? undefined : Number(row.usage_limit),
      paymentCount: Number(row.payment_count || 0),
      totalCollected: Number(row.total_collected || 0),
      isActive: String(row.status) === 'active',
      createdAt: String(row.created_at),
    }));
    return NextResponse.json({ success: true, paymentLinks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les liens de paiement.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const { title, description, amount, isFixedAmount, country, redirectUrl, applicationId } = values;
    const usageLimit = values.usageLimit ?? values.maxPayments;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160) {
      return NextResponse.json({ success: false, error: 'Un titre valide est requis.' }, { status: 400 });
    }
    if (typeof applicationId !== 'string' || !applicationId.trim()) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    if (values.currency !== undefined && String(values.currency).toUpperCase() !== 'XOF') {
      return NextResponse.json({ success: false, error: 'La configuration PayDunya actuelle prend en charge XOF uniquement.' }, { status: 400 });
    }

    const fixed = isFixedAmount !== false;
    const fixedAmount = Number(amount);
    if (fixed && (!Number.isSafeInteger(fixedAmount) || fixedAmount <= 0)) {
      return NextResponse.json({ success: false, error: 'Un montant fixe entier positif en XOF est requis.' }, { status: 400 });
    }
    if (usageLimit !== undefined && usageLimit !== null &&
        (!Number.isSafeInteger(Number(usageLimit)) || Number(usageLimit) <= 0)) {
      return NextResponse.json({ success: false, error: 'La limite d’utilisation doit être un entier positif.' }, { status: 400 });
    }
    if (redirectUrl && (typeof redirectUrl !== 'string' || !/^https:\/\//i.test(redirectUrl))) {
      return NextResponse.json({ success: false, error: 'L’URL de redirection doit utiliser HTTPS.' }, { status: 400 });
    }
    if (country !== undefined && String(country).toUpperCase() !== 'BJ') {
      return NextResponse.json({ success: false, error: 'Le pays de paiement configuré est le Bénin.' }, { status: 400 });
    }

    const db = getDb();
    const app = await getOwnedApplication(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const id = `pl_${crypto.randomUUID()}`;
    const slug = `pl-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30)}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const normalizedDescription = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
    const normalizedRedirect = typeof redirectUrl === 'string' ? redirectUrl : '';
    const normalizedUsageLimit = usageLimit === undefined || usageLimit === null ? null : Number(usageLimit);

    await db.execute({
      sql: `INSERT INTO payment_links
        (id, user_id, application_id, slug, title, description, amount, is_fixed_amount,
         currency, country, status, usage_count, usage_limit, require_phone, redirect_url,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'XOF', 'BJ', 'active', 0, ?, 1, ?, ?, ?)`,
      args: [
        id, user.id, applicationId, slug, title.trim(), normalizedDescription,
        fixed ? fixedAmount : null, fixed ? 1 : 0, normalizedUsageLimit,
        normalizedRedirect, now, now,
      ],
    });
    return NextResponse.json({
      success: true,
      paymentLink: {
        id, slug, title: title.trim(), description: normalizedDescription,
        amount: fixed ? fixedAmount : undefined, currency: 'XOF',
        isFixedAmount: fixed, country: 'BJ', redirectUrl: normalizedRedirect,
        usageLimit: normalizedUsageLimit ?? undefined, paymentCount: 0,
        totalCollected: 0, isActive: true, createdAt: now,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de créer le lien de paiement.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
