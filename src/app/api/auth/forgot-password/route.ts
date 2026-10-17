import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { sendPasswordResetEmail } from '@/src/server/email';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { email } = body || {};
    if (!email) {
      return NextResponse.json({ success: false, error: 'Adresse email requise.' }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, full_name FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé.',
      });
    }

    const user = userRes.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await db.execute({
      sql: "DELETE FROM email_verification_codes WHERE email = ? AND substr(id, 1, 5) = 'rset_'",
      args: [cleanEmail],
    });
    await db.execute({
      sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [`rset_${crypto.randomUUID()}`, user.id, cleanEmail, resetTokenHash, expiresAt, now],
    });

    try {
      const sent = await sendPasswordResetEmail(cleanEmail, resetToken, String(user.full_name));
      if (!sent) console.warn('[PichFlow Auth] Password reset email delivery failed.');
    } catch {
      console.warn('[PichFlow Auth] Password reset email delivery failed.');
    }

    return NextResponse.json({
      success: true,
      message: 'Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
