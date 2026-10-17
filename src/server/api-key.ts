import crypto from 'node:crypto';
import { ensureDatabaseInitialized, getDb } from './db';

export interface ApiKeyContext {
  id: string;
  userId: string;
  applicationId: string;
  environment: 'sandbox' | 'live';
  scope: string;
}

export class ApiKeyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export async function authenticateApiKey(
  request: Request,
  requiredScope: 'payin' | 'payout' = 'payin',
): Promise<ApiKeyContext> {
  await ensureDatabaseInitialized();
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new ApiKeyError('Clé API PichFlow requise dans Authorization: Bearer.', 401);
  }
  const secret = authorization.slice(7).trim();
  if (secret.length < 24 || secret.length > 256) {
    throw new ApiKeyError('Clé API invalide ou révoquée.', 401);
  }

  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  const result = await getDb().execute({
    sql: `SELECT k.id, k.user_id, k.application_id, k.environment, k.scope
          FROM api_credentials k
          JOIN applications a ON a.id = k.application_id AND a.user_id = k.user_id
          WHERE k.secret_hash = ? AND k.is_active = 1 AND a.status = 'active'
          LIMIT 1`,
    args: [secretHash],
  });
  const row = result.rows[0];
  if (!row) throw new ApiKeyError('Clé API invalide ou révoquée.', 401);

  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const configuredMode = process.env.PAYDUNYA_MODE?.trim().toLowerCase();
  const mode = configuredMode || (production ? '' : 'sandbox');
  if (mode !== 'sandbox' && mode !== 'live') {
    throw new ApiKeyError('PAYDUNYA_MODE doit être configuré explicitement avant l’API publique.', 503);
  }
  if (String(row.environment) !== mode) {
    throw new ApiKeyError('La clé API n’est pas valide pour cet environnement.', 403);
  }

  const scope = String(row.scope || 'both');
  if (scope !== 'both' && scope !== requiredScope) {
    throw new ApiKeyError('La clé API n’autorise pas cette opération.', 403);
  }
  await getDb().execute({
    sql: 'UPDATE api_credentials SET last_used_at = ? WHERE id = ? AND is_active = 1',
    args: [new Date().toISOString(), String(row.id)],
  });

  return {
    id: String(row.id),
    userId: String(row.user_id),
    applicationId: String(row.application_id),
    environment: mode,
    scope,
  };
}
