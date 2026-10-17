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
    const applicationId = searchParams.get('applicationId') || '';
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT wl.*, w.url as webhook_url 
            FROM webhook_logs wl
            LEFT JOIN webhooks w ON wl.webhook_id = w.id
            WHERE wl.user_id = ? AND w.application_id = ?
            ORDER BY wl.created_at DESC LIMIT 50`,
      args: [user.id, applicationId],
    });

    const logs = result.rows.map((r) => ({
      id: String(r.id),
      webhookId: String(r.webhook_id),
      event: String(r.event),
      url: String(r.webhook_url || ''),
      status: Number(r.status_code || 200),
      statusText: Number(r.status_code || 200) < 400 ? 'OK' : 'ERROR',
      durationMs: 120,
      timestamp: String(r.created_at),
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload,
      response: String(r.response_body || '{"received":true}'),
    }));

    return NextResponse.json({ success: true, logs, webhookLogs: logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
