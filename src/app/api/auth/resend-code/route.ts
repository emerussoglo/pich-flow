import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { sendVerificationCodeEmail } from '@/src/server/email';

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
      return NextResponse.json({ success: false, error: 'Email requis.' }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, full_name, is_verified FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun compte associé à cette adresse.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    if (Number(user.is_verified) === 1) {
      return NextResponse.json({ success: false, error: 'Ce compte est déjà vérifié. Vous pouvez vous connecter.' }, { status: 400 });
    }

    // Rate limit: 30s between resends
    const lastCodeRes = await db.execute({
      sql: 'SELECT created_at FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      args: [cleanEmail],
    });
    if (lastCodeRes.rows.length > 0) {
      const lastCreated = new Date(String(lastCodeRes.rows[0].created_at)).getTime();
      const diffSeconds = (Date.now() - lastCreated) / 1000;
      if (diffSeconds < 30) {
        return NextResponse.json(
          { success: false, error: `Veuillez patienter encore ${Math.ceil(30 - diffSeconds)} seconde(s) avant de demander un nouveau code.` },
          { status: 429 }
        );
      }
    }

    // Invalidate prior codes
    await db.execute({
      sql: 'DELETE FROM email_verification_codes WHERE email = ?',
      args: [cleanEmail],
    });

    const newCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `vc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        String(user.id),
        cleanEmail,
        newCode,
        expiresAt,
        0,
        now,
      ],
    });

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, newCode, String(user.full_name));
    } catch (mailErr: any) {
      console.warn('[PichFlow Auth] Resend email warning:', mailErr.message);
    }

    if (!emailSent) {
      return NextResponse.json(
        {
          success: false,
          emailSent: false,
          error: "L'e-mail contenant votre nouveau code n'a pas pu être délivré par le serveur SMTP. Veuillez réessayer ultérieurement.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      message: 'Un nouveau code de confirmation a été envoyé à votre adresse e-mail.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

