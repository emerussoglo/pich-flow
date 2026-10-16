import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUserFromRequest, verifyPassword, hashPassword } from '@/src/server/auth';
import { sendPasswordChangedNotificationEmail } from '@/src/server/email';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }

    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Mot de passe actuel et nouveau mot de passe requis.' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' }, { status: 400 });
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT password_hash, email, full_name FROM users WHERE id = ?',
      args: [authUser.id],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    const valid = verifyPassword(currentPassword, String(user.password_hash));
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Le mot de passe actuel est incorrect.' }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();

    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      args: [newHash, now, authUser.id],
    });

    sendPasswordChangedNotificationEmail(String(user.email), String(user.full_name)).catch(() => {});

    return NextResponse.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

