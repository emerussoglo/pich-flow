import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '@/src/config/payments';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, userHasSelectedApplication } from '@/src/server/auth';
import { getPaymentLinkUrl } from '@/src/server/urls';

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

    const result = await getDb().execute({
      sql: `SELECT pl.*,
              COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                JOIN checkout_sessions cs ON cs.reference = t.reference
                WHERE cs.payment_link_id = pl.id AND t.status IN ('success', 'completed')
              ), 0) AS total_collected
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
      amount: row.amount !== null ? Number(row.amount) : undefined,
      currency: String(row.currency || 'XOF'),
      isFixedAmount: Boolean(row.is_fixed_amount),
      country: String(row.country || ''),
      redirectUrl: String(row.redirect_url || ''),
      status: String(row.status),
      usageCount: Number(row.usage_count || 0),
      usageLimit: row.usage_limit !== null ? Number(row.usage_limit) : null,
      requirePhone: Boolean(row.require_phone),
      totalCollected: Number(row.total_collected || 0),
      createdAt: String(row.created_at),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      paymentUrl: getPaymentLinkUrl(String(row.slug), request.nextUrl.origin),
    }));

    return NextResponse.json({ success: true, paymentLinks });
  } catch (error) {
    console.error('[Payment Links] List failed:', error);
    return NextResponse.json({ success: false, error: 'Impossible de charger les liens de paiement.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Le corps JSON de la requête est invalide.' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
    const isFixedAmount = body.isFixedAmount !== false;
    const amount = body.amount === null || body.amount === undefined || body.amount === ''
      ? null
      : Number(body.amount);
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'XOF';
    const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
    const expiresAtInput = typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '';
    const expiresAt = expiresAtInput ? new Date(`${expiresAtInput}T23:59:59.999Z`) : null;
    const usageLimitValue = body.maxPayments ?? body.usageLimit;
    const usageLimit = usageLimitValue === null || usageLimitValue === undefined || usageLimitValue === ''
      ? null
      : Number(usageLimitValue);
    const redirectUrl = typeof body.redirectUrl === 'string' && body.redirectUrl.trim()
      ? body.redirectUrl.trim()
      : null;

    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    if (!title || title.length > 140) {
      return NextResponse.json({ success: false, error: 'Le nom du produit est requis (140 caractères maximum).' }, { status: 400 });
    }
    if (isFixedAmount && (amount === null || !Number.isSafeInteger(amount) || amount < PAYDUNYA_MINIMUM_AMOUNT_XOF)) {
      return NextResponse.json({
        success: false,
        error: `Saisissez un montant fixe entier d’au moins ${PAYDUNYA_MINIMUM_AMOUNT_XOF} XOF.`,
      }, { status: 400 });
    }
    if (!isFixedAmount && amount !== null) {
      return NextResponse.json({ success: false, error: 'Un lien à montant libre ne peut pas définir de montant fixe.' }, { status: 400 });
    }
    if (currency !== 'XOF' || (country && country !== 'BJ')) {
      return NextResponse.json({ success: false, error: 'La configuration PayDunya vérifiée ici prend en charge les paiements en XOF au Bénin.' }, { status: 400 });
    }
    if (expiresAtInput && (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      return NextResponse.json({ success: false, error: 'La date d’expiration doit être une date future valide.' }, { status: 400 });
    }
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
      return NextResponse.json({ success: false, error: 'La limite de paiements doit être un entier positif.' }, { status: 400 });
    }
    if (redirectUrl) {
      try {
        if (new URL(redirectUrl).protocol !== 'https:') throw new Error('HTTPS required');
      } catch {
        return NextResponse.json({ success: false, error: 'L’URL de redirection doit être une URL HTTPS valide.' }, { status: 400 });
      }
    }
    const id = `pl_${crypto.randomUUID()}`;
    const cleanSlug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 55) || 'paiement';
    const slug = `${cleanSlug}-${crypto.randomBytes(5).toString('hex')}`;
    const now = new Date().toISOString();

    await getDb().execute({
      sql: `INSERT INTO payment_links (
              id, user_id, application_id, slug, title, description, amount,
              is_fixed_amount, currency, country, status, usage_count, usage_limit,
              require_phone, expires_at, redirect_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, user.id, applicationId, slug, title, description, amount,
        isFixedAmount ? 1 : 0, currency, country, usageLimit,
        body.requirePhone === true ? 1 : 0, expiresAt?.toISOString() || null, redirectUrl, now, now,
      ],
    });

    const paymentLink = {
      id,
      slug,
      title,
      description,
      amount,
      currency,
      isFixedAmount,
      country,
      expiresAt: expiresAt?.toISOString() || null,
      redirectUrl: redirectUrl || '',
      status: 'active',
      usageCount: 0,
      usageLimit,
      requirePhone: body.requirePhone === true,
      totalCollected: 0,
      isActive: true,
      createdAt: now,
      paymentUrl: getPaymentLinkUrl(slug, request.nextUrl.origin),
    };

    return NextResponse.json({ success: true, paymentLink });
  } catch (error) {
    console.error('[Payment Links] Creation failed:', error);
    return NextResponse.json({ success: false, error: 'Impossible d’enregistrer le lien de paiement.' }, { status: 500 });
  }
}
