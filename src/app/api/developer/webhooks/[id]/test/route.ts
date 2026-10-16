import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { id } = await context.params;
    const db = getDb();
    const whRes = await db.execute({
      sql: 'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      args: [id, user.id],
    });

    if (whRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Webhook introuvable.' }, { status: 404 });
    }

    const webhook = whRes.rows[0];
    const testPayload = {
      event: 'webhook.test',
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        id: `whk_test_${Date.now()}`,
        reference: `PF-TEST-${Date.now().toString().slice(-6)}`,
        status: 'success',
        amount: 10000,
        currency: 'XOF',
        message: 'Notification webhook de test générée par PichFlow.',
      },
    };

    const rawPayload = JSON.stringify(testPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', String(webhook.secret))
      .update(`${timestamp}.${rawPayload}`)
      .digest('hex');

    let deliveryStatus = 'failed';
    let httpStatus = 0;
    let responseBody = '';

    try {
      const response = await fetch(String(webhook.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'User-Agent': 'PichFlow-Webhooks/1.0',
        },
        body: rawPayload,
        signal: AbortSignal.timeout(6000),
      });

      httpStatus = response.status;
      responseBody = (await response.text()).slice(0, 500);
      deliveryStatus = response.ok ? 'success' : 'failed';
    } catch (err: any) {
      responseBody = err.message;
      deliveryStatus = 'failed';
    }

    // Log delivery
    const logId = `whl_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO webhook_logs (id, webhook_id, event, payload, response_status, response_body, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        logId,
        id,
        'webhook.test',
        rawPayload,
        httpStatus,
        responseBody,
        deliveryStatus,
        new Date().toISOString(),
      ],
    });

    return NextResponse.json({
      success: deliveryStatus === 'success',
      message: deliveryStatus === 'success' ? 'Événement de test délivré avec succès.' : 'Échec de la distribution du webhook test.',
      delivery: {
        status: deliveryStatus,
        httpStatus,
        response: responseBody,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

