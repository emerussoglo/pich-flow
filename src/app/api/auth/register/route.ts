import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/src/server/db';
import { hashPassword } from '@/src/server/auth';
import { sendVerificationCodeEmail } from '@/src/server/email';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { email, password, country, phone } = body || {};
    const fullNameValue = body?.fullName || body?.name;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof fullNameValue !== 'string' ||
      !fullNameValue.trim()
    ) {
      return NextResponse.json({ success: false, error: 'Email, mot de passe et nom complet requis.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ success: false, error: 'Format d’adresse email invalide.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id, is_verified FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (Number(existingUser.is_verified) === 1) {
        return NextResponse.json(
          { success: false, error: 'Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, connectez-vous.' },
          { status: 400 }
        );
      }
      // Cleanup unverified record so user can register fresh
      await db.execute({ sql: 'DELETE FROM email_verification_codes WHERE email = ?', args: [cleanEmail] });
      await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [String(existingUser.id)] });
    }

    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    // Accounts start unverified (is_verified = 0) until confirmation code is entered
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, full_name, phone, country, role, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        cleanEmail,
        passwordHash,
        fullNameValue.trim(),
        phone || '',
        country || 'BJ',
        'merchant',
        0,
        now,
        now,
      ],
    });

    // Generate a secure random 6-digit confirmation code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes validity

    await db.execute({
      sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `vc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        userId,
        cleanEmail,
        verificationCode,
        expiresAt,
        0,
        now,
      ],
    });

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, verificationCode, fullNameValue.trim());
    } catch (mailErr: any) {
      console.warn('[PichFlow Auth] Mail dispatch warning:', mailErr.message);
    }

    return NextResponse.json({
      success: true,
      requireVerification: true,
      email: cleanEmail,
      emailSent,
      message: emailSent
        ? 'Compte créé avec succès ! Veuillez saisir le code de confirmation envoyé à votre adresse email.'
        : 'Compte créé. Veuillez vérifier vos emails pour le code de confirmation.',
    });
  } catch (err: any) {
    console.error('[API] /api/auth/register error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

