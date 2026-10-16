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
    let sql = 'SELECT * FROM api_credentials WHERE user_id = ?';
    const args: any[] = [user.id];

    if (applicationId.trim()) {
      sql += ' AND application_id = ?';
      args.push(applicationId.trim());
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.execute({ sql, args });

    const apiKeys = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      keyPrefix: String(row.key_prefix),
      environment: String(row.environment) as 'sandbox' | 'live',
      scope: String(row.scope || 'both') as 'payin' | 'payout' | 'both',
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    }));

    return NextResponse.json({ success: true, apiKeys });
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

    const { name, scope, applicationId } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nom de la clé requis.' }, { status: 400 });
    }

    const cleanName = name.trim();
    const resolvedAppId = applicationId || 'app_default';
    const now = new Date().toISOString();
    const db = getDb();

    // Generate dual keys: 1 Sandbox (sk_test_) + 1 Live (sk_live_)
    const testSecret = `sk_test_${crypto.randomBytes(24).toString('hex')}`;
    const liveSecret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;

    const testId = `key_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const liveId = `key_live_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const testHash = crypto.createHash('sha256').update(testSecret).digest('hex');
    const liveHash = crypto.createHash('sha256').update(liveSecret).digest('hex');

    const testPrefix = testSecret.substring(0, 15) + '...';
    const livePrefix = liveSecret.substring(0, 15) + '...';

    // 1. Insert Sandbox key
    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, key_prefix, secret_hash, environment, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'sandbox', ?, 1, ?)`,
      args: [testId, user.id, resolvedAppId, `${cleanName} (Sandbox)`, testPrefix, testHash, scope || 'both', now],
    });

    // 2. Insert Live key
    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, key_prefix, secret_hash, environment, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'live', ?, 1, ?)`,
      args: [liveId, user.id, resolvedAppId, `${cleanName} (Live)`, livePrefix, liveHash, scope || 'both', now],
    });

    const sandboxKey = {
      id: testId,
      name: `${cleanName} (Sandbox)`,
      keyPrefix: testPrefix,
      secretKey: testSecret,
      environment: 'sandbox' as const,
      scope: (scope || 'both') as 'payin' | 'payout' | 'both',
      isActive: true,
      createdAt: now,
    };

    const liveKey = {
      id: liveId,
      name: `${cleanName} (Live)`,
      keyPrefix: livePrefix,
      secretKey: liveSecret,
      environment: 'live' as const,
      scope: (scope || 'both') as 'payin' | 'payout' | 'both',
      isActive: true,
      createdAt: now,
    };

    return NextResponse.json({
      success: true,
      apiKey: sandboxKey,
      keys: {
        sandbox: sandboxKey,
        live: liveKey,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

