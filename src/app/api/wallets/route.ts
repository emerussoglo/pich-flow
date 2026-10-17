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
      sql: 'SELECT * FROM wallets WHERE user_id = ? AND application_id = ? ORDER BY is_default DESC, created_at ASC',
      args: [user.id, applicationId],
    });

    const wallets = result.rows.map((row) => ({
      id: String(row.id),
      currency: String(row.currency),
      symbol: String(row.symbol || row.currency),
      balance: Number(row.balance),
      pendingBalance: Number(row.pending_balance || 0),
      reservedBalance: Number(row.reserved_balance || 0),
      countryCode: String(row.country_code || 'BJ'),
      isDefault: Boolean(row.is_default),
    }));

    return NextResponse.json({
      success: true,
      wallets,
      providerBalanceAvailable: false,
      balanceNote: 'PayDunya ne fournit pas de solde marchand via l’intégration actuellement utilisée.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { applicationId } = body;
    if (typeof applicationId !== 'string' || !await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: 'La création de portefeuilles n’est pas prise en charge par PayDunya dans l’intégration actuelle.',
    }, { status: 501 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
