import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from './db';

const SALT = 'pichflow_salt_2026';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country: string;
  role: string;
  is_verified: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  apiKey?: {
    id: string;
    environment: 'sandbox' | 'live';
    application_id: string;
    scope: string;
  };
}

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const calculated = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: string, req: Request): Promise<string> {
  const db = getDb();
  const token = generateToken();
  const id = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();
  // Session strictly lasts 15 hours after authentication
  const expiresAt = new Date(now.getTime() + 15 * 60 * 60 * 1000).toISOString();
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown';

  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, token, ip, ua, expiresAt, now.toISOString()],
  });

  return token;
}

export async function destroySession(token: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM sessions WHERE token = ?',
    args: [token],
  });
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const authHeader = req.headers.authorization;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if ((req as any).cookies && (req as any).cookies.token) {
    token = (req as any).cookies.token;
  }

  if (token) {
    const sessionRes = await db.execute({
      sql: `SELECT s.*, u.id as u_id, u.email, u.full_name, u.phone, u.country, u.role, u.is_verified
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
      args: [token],
    });

    if (sessionRes.rows.length > 0) {
      const row = sessionRes.rows[0];
      req.user = {
        id: String(row.u_id),
        email: String(row.email),
        full_name: String(row.full_name),
        phone: String(row.phone || ''),
        country: String(row.country || 'BJ'),
        role: String(row.role || 'merchant'),
        is_verified: Number(row.is_verified || 1),
      };
      return next();
    }
  }

  res.status(401).json({ success: false, error: 'Non authentifié. Veuillez vous connecter.' });
}

export async function requireApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Clé API manquante (Authorization: Bearer sk_...)' });
    return;
  }

  const key = authHeader.substring(7).trim();
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const keyRes = await db.execute({
    sql: `SELECT k.*, u.id as u_id, u.email, u.full_name, u.phone, u.country, u.role, u.is_verified
          FROM api_credentials k
          JOIN users u ON k.user_id = u.id
          WHERE (k.secret_key = ? OR k.secret_hash = ?) AND k.is_active = 1`,
    args: [key, keyHash],
  });

  if (keyRes.rows.length === 0) {
    res.status(401).json({ success: false, error: 'Clé API invalide ou révoquée.' });
    return;
  }

  const row = keyRes.rows[0];
  req.user = {
    id: String(row.u_id),
    email: String(row.email),
    full_name: String(row.full_name),
    phone: String(row.phone || ''),
    country: String(row.country || 'BJ'),
    role: String(row.role || 'merchant'),
    is_verified: Number(row.is_verified || 1),
  };
  req.apiKey = {
    id: String(row.id),
    environment: String(row.environment) as 'sandbox' | 'live',
    application_id: String(row.application_id),
    scope: String(row.scope),
  };

  // Update last_used_at
  db.execute({
    sql: 'UPDATE api_credentials SET last_used_at = ? WHERE id = ?',
    args: [new Date().toISOString(), String(row.id)],
  }).catch(() => {});

  next();
}
