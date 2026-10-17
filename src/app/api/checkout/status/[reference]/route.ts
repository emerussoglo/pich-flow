import { NextRequest, NextResponse } from 'next/server';
import { CheckoutError, getCheckoutStatus } from '@/src/server/checkout';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await context.params;
    return NextResponse.json(await getCheckoutStatus(reference));
  } catch (error) {
    const status = error instanceof CheckoutError ? error.statusCode : 502;
    const message = error instanceof Error ? error.message : 'Impossible de vérifier le paiement.';
    if (!(error instanceof CheckoutError)) {
      console.error('[PayDunya checkout] Status verification failed.');
    }
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
