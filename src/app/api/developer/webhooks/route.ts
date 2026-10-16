import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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
    const applicationId = searchParams.get('applicationId') || searchParams.get('appId') || '';

    const db = getDb();
    let sql = 'SELECT * FROM webhooks WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.execute({ sql, args });

    const webhooks = result.rows.map((row) => ({
      id: String(row.id),
      url: String(row.url),
      description: String(row.description || ''),
      secret: String(row.secret),
      events: String(row.events).split(','),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      lastDeliveryStatus: String(row.last_delivery_status || 'success'),
    }));

    return NextResponse.json({ success: true, webhooks });
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

    const { url, description, applicationId } = body;
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL du webhook requise.' }, { status: 400 });
    }

    const id = `whk_${Date.now()}`;
    const secret = `whsec_pf_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO webhooks (id, user_id, application_id, url, description, secret, events, is_active, last_delivery_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        user.id,
        applicationId || 'app_default',
        url,
        description || 'Endpoint webhook',
        secret,
        'payment.created,payment.success,payment.failed',
        1,
        'success',
        now,
      ],
    });

    const webhook = {
      id,
      url,
      description: description || 'Endpoint webhook',
      secret,
      events: ['payment.created', 'payment.success', 'payment.failed'],
      isActive: true,
      createdAt: now,
      lastDeliveryStatus: 'success',
    };

    return NextResponse.json({ success: true, webhook });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

