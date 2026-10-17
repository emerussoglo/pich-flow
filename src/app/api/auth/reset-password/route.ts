import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { hashPassword } from '@/src/server/auth';
import { sendPasswordChangedNotificationEmail } from '@/src/server/email';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { token, newPassword } = body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) || !newPassword) {
      return NextResponse.json({ success: false, error: 'Token et nouveau mot de passe requis.' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' }, { status: 400 });
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: `SELECT u.*, codes.id AS reset_code_id
            FROM email_verification_codes codes
            JOIN users u ON u.id = codes.user_id
            WHERE substr(codes.id, 1, 5) = 'rset_'
              AND codes.code = ?
              AND datetime(codes.expires_at) > datetime('now')
            LIMIT 1`,
      args: [crypto.createHash('sha256').update(String(token)).digest('hex')],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Lien de réinitialisation invalide ou expiré.' }, { status: 400 });
    }

    const user = userRes.rows[0];
    const passwordHash = hashPassword(newPassword);
    const now = new Date().toISOString();

    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      args: [passwordHash, now, user.id],
    });
    await db.execute({
      sql: 'DELETE FROM email_verification_codes WHERE id = ?',
      args: [user.reset_code_id],
    });
    await db.execute({
      sql: 'DELETE FROM sessions WHERE user_id = ?',
      args: [user.id],
    });

    try {
      await sendPasswordChangedNotificationEmail(String(user.email), String(user.full_name));
    } catch {
      console.warn('[PichFlow Auth] Password change notification email delivery failed.');
    }

    return NextResponse.json({
      success: true,
      message: 'Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
