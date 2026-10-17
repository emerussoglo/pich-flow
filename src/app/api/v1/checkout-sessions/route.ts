import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyError, authenticateApiKey } from '@/src/server/api-key';
import { CheckoutError, createCheckout } from '@/src/server/checkout';
import { ensureDatabaseInitialized, getDb } from '@/src/server/db';

export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  const status = error instanceof ApiKeyError || error instanceof CheckoutError
    ? error.statusCode
    : 500;
  const message = error instanceof Error ? error.message : 'Erreur interne de l’API.';
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const key = await authenticateApiKey(request, 'payin');
    await ensureDatabaseInitialized();
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const linkId = typeof values.paymentLinkId === 'string' ? values.paymentLinkId.trim() : '';
    const linkSlug = typeof values.paymentLinkSlug === 'string' ? values.paymentLinkSlug.trim() : '';
    if (Boolean(linkId) === Boolean(linkSlug)) {
      return NextResponse.json({ success: false, error: 'paymentLinkId ou paymentLinkSlug requis.' }, { status: 400 });
    }
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: 'L’en-tête Idempotency-Key est requis.' }, { status: 400 });
    }

    const link = await getDb().execute({
      sql: `SELECT id FROM payment_links
            WHERE ${linkId ? 'id = ?' : 'slug = ?'}
              AND user_id = ? AND application_id = ? AND status = 'active'
            LIMIT 1`,
      args: [linkId || linkSlug, key.userId, key.applicationId],
    });
    if (!link.rows[0]) {
      return NextResponse.json({ success: false, error: 'Lien introuvable pour cette application.' }, { status: 404 });
    }

    const result = await createCheckout({
      paymentLinkId: linkId || String(link.rows[0].id),
      amount: values.amount,
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      customerPhone: values.customerPhone,
    }, idempotencyKey);
    return NextResponse.json({
      success: true,
      data: {
        id: result.reference,
        reference: result.reference,
        status: result.status,
        amount: result.totalAmount,
        currency: 'XOF',
        checkoutUrl: result.invoiceUrl,
      },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
