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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.execute({
      sql: 'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      args: [resetToken, expiresAt, user.id],
    });

    sendPasswordResetEmail(cleanEmail, resetToken, String(user.full_name)).catch((err) =>
      console.warn('[PichFlow Auth] Reset email error:', err.message)
    );

    return NextResponse.json({
      success: true,
      message: 'Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

