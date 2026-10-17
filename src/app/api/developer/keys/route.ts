import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest } from '@/src/server/auth';

export const runtime = 'nodejs';

async function hasApplicationAccess(applicationId: string, userId: string) {
  return getDb().execute({
    sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
    args: [applicationId, userId],
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    const applicationId = request.nextUrl.searchParams.get('applicationId')?.trim();
    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId requis.' }, { status: 400 });
    }
    const app = await hasApplicationAccess(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const result = await getDb().execute({
      sql: `SELECT id, name, prefix, secret_masked, environment, scope, is_active,
                   last_used_at, created_at
            FROM api_credentials
            WHERE user_id = ? AND application_id = ?
            ORDER BY created_at DESC`,
      args: [user.id, applicationId],
    });
    const keys = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      prefix: String(row.prefix),
      secretMasked: String(row.secret_masked),
      environment: String(row.environment) as 'sandbox' | 'live',
      scope: String(row.scope || 'payin'),
      isActive: Boolean(row.is_active),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      createdAt: String(row.created_at),
    }));
    return NextResponse.json({ success: true, apiKeys: keys });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les clés API.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Requête JSON invalide.' }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const applicationId = typeof values.applicationId === 'string' ? values.applicationId.trim() : '';
    const name = typeof values.name === 'string' ? values.name.trim() : '';
    const requestedScope = values.scope;
    const environment = values.environment === undefined ? 'sandbox' : values.environment;
    if (!applicationId || !name || name.length > 100) {
      return NextResponse.json({ success: false, error: 'Nom et applicationId requis.' }, { status: 400 });
    }
    if (environment !== 'sandbox' && environment !== 'live') {
      return NextResponse.json({ success: false, error: 'environment doit valoir sandbox ou live.' }, { status: 400 });
    }
    if (requestedScope !== undefined && requestedScope !== 'payin') {
      return NextResponse.json({ success: false, error: 'Seul le périmètre payin est actuellement disponible.' }, { status: 400 });
    }
    if (environment === 'live' && process.env.PAYDUNYA_MODE?.trim().toLowerCase() !== 'live') {
      return NextResponse.json({
        success: false,
        error: 'Une clé Live ne peut être créée qu’après configuration explicite de PAYDUNYA_MODE=live.',
      }, { status: 409 });
    }

    const db = getDb();
    const app = await hasApplicationAccess(applicationId, user.id);
    if (app.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }
    const scope = 'payin';
    const now = new Date().toISOString();
    const secret = `${environment === 'sandbox' ? 'pf_test' : 'pf_live'}_${crypto.randomBytes(32).toString('base64url')}`;
    const apiKey = {
      id: `key_${crypto.randomUUID()}`,
      name,
      prefix: secret.slice(0, 16),
      secretKey: secret,
      secretMasked: `${secret.slice(0, 16)}…`,
      environment,
      scope,
      isActive: true,
      createdAt: now,
    };

    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `INSERT INTO api_credentials
          (id, user_id, application_id, name, environment, prefix, secret_key,
           secret_masked, secret_hash, scope, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, 1, ?)`,
        args: [
          apiKey.id, user.id, applicationId, apiKey.name, apiKey.environment,
          apiKey.prefix, apiKey.secretMasked, crypto.createHash('sha256').update(secret).digest('hex'),
          scope, now,
        ],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    return NextResponse.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de créer les clés API.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
