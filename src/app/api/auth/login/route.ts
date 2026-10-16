import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { verifyPassword, createSession } from '@/src/server/auth';
import { sendLoginNotificationEmail } from '@/src/server/email';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { email, password } = body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ success: false, error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Identifiants incorrects.' }, { status: 401 });
    }

    const user = userRes.rows[0];
    const valid = verifyPassword(password, String(user.password_hash));
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Identifiants incorrects.' }, { status: 401 });
    }

    // Check if account is verified
    if (Number(user.is_verified) === 0) {
      return NextResponse.json(
        {
          success: false,
          requireVerification: true,
          email: cleanEmail,
          error: 'Votre adresse e-mail n’est pas encore confirmée. Veuillez saisir le code de vérification reçu.',
        },
        { status: 403 }
      );
    }

    // Create 15-hour session token
    const token = await createSession(String(user.id), request);

    // Extract client IP and user agent
    const forwarded = request.headers.get('x-forwarded-for');
    const rawIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const cleanIp = rawIp.replace(/^::ffff:/, '');
    const displayIp = cleanIp === '::1' || cleanIp === '127.0.0.1' ? '127.0.0.1 (Localhost)' : cleanIp;
    const userAgent = request.headers.get('user-agent') || 'Navigateur Web';

    // Async login security alert email (does not fail login if SMTP fails)
    sendLoginNotificationEmail(cleanEmail, String(user.full_name), {
      ip: displayIp,
      userAgent,
      time: new Date().toISOString(),
    }).catch((err) => console.warn('[PichFlow Auth] Login alert email warning:', err.message));

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: String(user.id),
        email: String(user.email),
        full_name: String(user.full_name),
        phone: String(user.phone || ''),
        country: String(user.country || 'BJ'),
        role: String(user.role || 'merchant'),
      },
    });

    // Set secure cookie for session persistence
    response.cookies.set('pf_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 60, // 15 hours
    });

    return response;
  } catch (err: any) {
    console.error('[API] /api/auth/login error:', err);
    return NextResponse.json(
      { success: false, error: 'Une erreur interne est survenue lors de la connexion.' },
      { status: 500 }
    );
  }
}
