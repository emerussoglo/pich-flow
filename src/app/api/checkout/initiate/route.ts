import { NextRequest, NextResponse } from 'next/server';
import { CheckoutError, createCheckout } from '@/src/server/checkout';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    const result = await createCheckout(
      body,
      request.headers.get('idempotency-key'),
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof CheckoutError ? error.statusCode : 502;
    const message = error instanceof Error ? error.message : 'Échec de la création du paiement.';
    if (!(error instanceof CheckoutError)) {
      console.error('[PayDunya checkout] Invoice creation failed.');
    }
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
