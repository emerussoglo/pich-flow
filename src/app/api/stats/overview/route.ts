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
    const period = searchParams.get('period') || '30j';
    const targetAppId = (searchParams.get('appId') || searchParams.get('applicationId') || '').trim();
    if (!targetAppId) {
      return NextResponse.json({ success: false, error: 'Application requise.' }, { status: 400 });
    }

    let days = 30;
    if (period === '7j') days = 7;
    else if (period === '90j') days = 90;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb();
    const application = await db.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [targetAppId, user.id],
    });
    if (application.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE user_id = ? AND application_id = ? AND created_at >= ?',
      args: [user.id, targetAppId, startDate],
    });
    const txs = result.rows;

    const totalCount = txs.length;
    const successCount = txs.filter((t) => t.status === 'success' || t.status === 'completed').length;
    const failedCount = txs.filter((t) => t.status === 'failed').length;
    const pendingCount = txs.filter((t) => t.status === 'pending').length;
    const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';
    const revenue = txs
      .filter((t) => t.status === 'success' || t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);

    const countryMap: Record<string, number> = {};
    txs
      .filter((t) => t.status === 'success' || t.status === 'completed')
      .forEach((t) => {
        const c = String(t.country || 'BJ');
        countryMap[c] = (countryMap[c] || 0) + Number(t.amount || 0);
      });

    const methodMap: Record<string, number> = {};
    txs
      .filter((t) => t.status === 'success' || t.status === 'completed')
      .forEach((t) => {
        const m = String(t.payment_method || t.provider || 'Mobile Money');
        methodMap[m] = (methodMap[m] || 0) + Number(t.amount || 0);
      });

    return NextResponse.json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        successfulTransactions: successCount,
        failedTransactions: failedCount,
        pendingTransactions: pendingCount,
        successRate: `${successRate}%`,
        revenue,
        currency: 'XOF',
        countryBreakdown: countryMap,
        methodBreakdown: methodMap,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
