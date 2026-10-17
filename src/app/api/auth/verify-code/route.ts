import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { createSession } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { email, code } = body || {};
    if (!email || !code) {
      return NextResponse.json({ success: false, error: 'Email et code de confirmation requis.' }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanCode = String(code).trim();
    const db = getDb();

    const codeRes = await db.execute({
      sql: 'SELECT * FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      args: [cleanEmail],
    });

    if (codeRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun code de vérification trouvé pour cette adresse. Demandez un nouveau code.' }, { status: 400 });
    }

    const record = codeRes.rows[0];
    const now = new Date().toISOString();

    // Max 5 attempts
    const attempts = Number(record.attempts || 0);
    if (attempts >= 5) {
      return NextResponse.json({ success: false, error: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.' }, { status: 429 });
    }

    // Check expiration
    if (new Date(String(record.expires_at)) < new Date()) {
      return NextResponse.json({ success: false, error: 'Le code de confirmation a expiré. Veuillez en demander un nouveau.' }, { status: 400 });
    }

    if (String(record.code) !== cleanCode) {
      await db.execute({
        sql: 'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?',
        args: [String(record.id)],
      });
      return NextResponse.json(
        { success: false, error: `Code de confirmation incorrect (${4 - attempts} tentative(s) restante(s)).` },
        { status: 400 }
      );
    }

    const userId = String(record.user_id);

    // Mark user as verified
    await db.execute({
      sql: 'UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?',
      args: [now, userId],
    });

    // Delete used verification codes for this email
    await db.execute({
      sql: 'DELETE FROM email_verification_codes WHERE email = ?',
      args: [cleanEmail],
    });

    // Retrieve verified user
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });
    const user = userRes.rows[0];

    // Create 15-hour session
    const token = await createSession(userId, request);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        full_name: String(user.full_name),
        phone: String(user.phone || ''),
        country: String(user.country || 'BJ'),
        role: String(user.role || 'merchant'),
      },
    });

    response.cookies.set('pf_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('[API] Verify code error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
