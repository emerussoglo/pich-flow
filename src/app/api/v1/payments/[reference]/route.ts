import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyError, authenticateApiKey } from '@/src/server/api-key';
import { CheckoutError, getCheckoutStatus } from '@/src/server/checkout';
import { ensureDatabaseInitialized, getDb } from '@/src/server/db';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    const key = await authenticateApiKey(request, 'payin');
    await ensureDatabaseInitialized();
    const { reference } = await context.params;
    const ownedSession = await getDb().execute({
      sql: `SELECT reference FROM checkout_sessions
            WHERE reference = ? AND user_id = ? AND application_id = ? AND provider = 'paydunya'
            LIMIT 1`,
      args: [reference, key.userId, key.applicationId],
    });
    if (!ownedSession.rows[0]) {
      return NextResponse.json({ success: false, error: 'Paiement introuvable pour cette application.' }, { status: 404 });
    }
    const result = await getCheckoutStatus(reference);
    return NextResponse.json({
      success: true,
      data: {
        id: result.reference,
        reference: result.reference,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
      },
    });
  } catch (error) {
    const status = error instanceof ApiKeyError || error instanceof CheckoutError
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : 'Impossible de vérifier le paiement.';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
