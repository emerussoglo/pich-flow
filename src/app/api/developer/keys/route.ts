import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

    const result = await getDb().execute({
      sql: 'SELECT * FROM api_credentials WHERE user_id = ? AND application_id = ? ORDER BY created_at DESC',
      args: [user.id, applicationId],
    });
    const apiKeys = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      prefix: String(row.prefix),
      secretMasked: String(row.secret_masked),
      secretKey: '',
      environment: String(row.environment) as 'sandbox' | 'live',
      scope: String(row.scope || 'both') as 'payin' | 'payout' | 'both',
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    }));

    return NextResponse.json({ success: true, apiKeys });
  } catch (error) {
    console.error('[API Keys] List failed:', error);
    return NextResponse.json({ success: false, error: 'Impossible de charger les clés API.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Le corps JSON de la requête est invalide.' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
    const scope = body.scope || 'both';
    if (!name) {
      return NextResponse.json({ success: false, error: 'Nom de la clé requis.' }, { status: 400 });
    }
    if (name.length > 100 || !['payin', 'payout', 'both'].includes(String(scope))) {
      return NextResponse.json({ success: false, error: 'Nom ou permission de clé invalide.' }, { status: 400 });
    }
    if (!await userHasSelectedApplication(user, applicationId)) {
      return NextResponse.json({ success: false, error: 'Application introuvable.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const credentials = (['sandbox', 'live'] as const).map((environment) => {
      const secret = `sk_${environment === 'sandbox' ? 'test' : 'live'}_pichflow_${crypto.randomBytes(32).toString('hex')}`;
      const prefix = secret.slice(0, 18);
      return {
        id: `key_${crypto.randomUUID()}`,
        name: `${name} (${environment === 'sandbox' ? 'Sandbox' : 'Live'})`,
        environment,
        prefix,
        secret,
        secretHash: crypto.createHash('sha256').update(secret).digest('hex'),
        secretMasked: `${prefix}...${secret.slice(-4)}`,
      };
    });

    const db = getDb();
    const inserted: string[] = [];
    try {
      for (const credential of credentials) {
        await db.execute({
          sql: `INSERT INTO api_credentials (
                  id, user_id, application_id, name, environment, prefix,
                  secret_key, secret_masked, secret_hash, scope, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, 1, ?)`,
          args: [
            credential.id, user.id, applicationId, credential.name,
            credential.environment, credential.prefix, credential.secretMasked,
            credential.secretHash, String(scope), now,
          ],
        });
        inserted.push(credential.id);
      }
    } catch (error) {
      if (inserted.length > 0) {
        await db.execute({
          sql: `DELETE FROM api_credentials WHERE user_id = ? AND id IN (${inserted.map(() => '?').join(',')})`,
          args: [user.id, ...inserted],
        });
      }
      throw error;
    }

    const [sandbox, live] = credentials;
    const formatKey = (credential: typeof sandbox) => ({
      id: credential.id,
      name: credential.name,
      prefix: credential.prefix,
      secretMasked: credential.secretMasked,
      secretKey: credential.secret,
      environment: credential.environment,
      scope,
      isActive: true,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      apiKey: formatKey(sandbox),
      keys: { sandbox: formatKey(sandbox), live: formatKey(live) },
    });
  } catch (error) {
    console.error('[API Keys] Creation failed:', error);
    return NextResponse.json({ success: false, error: 'Impossible de créer les clés API.' }, { status: 500 });
  }
}
