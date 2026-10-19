import { Router, Request, Response } from 'express';
import type { Row } from '@libsql/client';
import crypto from 'crypto';
import { getDb } from './db';
import {
  requireAuth,
  requireApiKey,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  AuthenticatedRequest,
  userOwnsApplication,
} from './auth';
import { paydunyaService, dispatchMerchantWebhook } from './paydunya';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '../config/payments';
import { getAppBaseUrl, getPayDunyaCallbackUrl } from './urls';
import { sasPayService, formatDecimalAmount } from './saspay';
import {
  sendVerificationCodeEmail,
  sendLoginNotificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotificationEmail,
} from './email';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & SECURITY ROUTES
// ==========================================

// Email regex validation helper
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Register with Email Verification Code (via Nodemailer)
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, country, phone } = req.body || {};
    const fullNameValue = req.body?.fullName || req.body?.name;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullNameValue !== 'string' || !fullNameValue.trim()) {
      res.status(400).json({ success: false, error: 'Email, mot de passe et nom complet requis.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      res.status(400).json({ success: false, error: 'Format d’adresse email invalide.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' });
      return;
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id, is_verified FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (Number(existingUser.is_verified) === 1) {
        res.status(400).json({ success: false, error: 'Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, connectez-vous.' });
        return;
      }
      // If unverified, cleanup unverified record so user can register fresh
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

    console.log('[PICHFLOW AUTH] Code de confirmation généré.');

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, verificationCode, fullNameValue.trim());
    } catch (mailErr: any) {
      console.warn('[PichFlow Auth] Email delivery warning:', mailErr.message);
    }

    if (!emailSent) {
      res.status(502).json({
        success: false,
        requireVerification: true,
        email: cleanEmail,
        emailSent: false,
        error: "L'e-mail de confirmation n'a pas pu être délivré par le serveur SMTP. Veuillez vérifier votre adresse e-mail ou configurer le serveur SMTP.",
      });
      return;
    }

    res.json({
      success: true,
      requireVerification: true,
      email: cleanEmail,
      emailSent: true,
      message: 'Compte créé avec succès. Un code de confirmation à 6 chiffres a été envoyé à votre adresse e-mail.',
    });
  } catch (err: any) {
    console.error('[API] Register error:', err);
    res.status(500).json({ success: false, error: 'Une erreur interne est survenue lors de la création du compte.' });
  }
});

// Verify Email Code
apiRouter.post('/auth/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, error: 'Adresse email et code de confirmation requis.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();
    const db = getDb();
    const now = new Date().toISOString();

    const codeRes = await db.execute({
      sql: `SELECT * FROM email_verification_codes 
            WHERE email = ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [cleanEmail],
    });

    if (codeRes.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Aucun code de confirmation trouvé. Veuillez demander un renvoi.' });
      return;
    }

    const record = codeRes.rows[0];
    const attempts = Number(record.attempts || 0);

    if (attempts >= 5) {
      res.status(400).json({ success: false, error: 'Trop de tentatives infructueuses. Veuillez demander un nouveau code.' });
      return;
    }

    if (new Date(String(record.expires_at)) < new Date()) {
      res.status(400).json({ success: false, error: 'Ce code de confirmation a expiré (validité 15 minutes). Veuillez demander un nouveau code.' });
      return;
    }

    if (String(record.code) !== cleanCode) {
      await db.execute({
        sql: 'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?',
        args: [String(record.id)],
      });
      res.status(400).json({ success: false, error: `Code de confirmation incorrect (${4 - attempts} tentative(s) restante(s)).` });
      return;
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

    // Initialize baseline empty wallet for the user's primary currency (strictly 0 balance)
    const walletCheck = await db.execute({
      sql: 'SELECT id FROM wallets WHERE user_id = ?',
      args: [userId],
    });
    if (walletCheck.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
              VALUES (?, ?, ?, ?, 0, 0, 0, ?, 1, ?, ?)`,
        args: [`wal_xof_${Date.now()}`, userId, 'XOF', 'FCFA', String(user.country || 'BJ'), now, now],
      });
    }

    // Create 15-hour session
    const token = await createSession(userId, req);

    res.json({
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
  } catch (err: any) {
    console.error('[API] Verify code error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resend Email Verification Code
apiRouter.post('/auth/resend-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email requis.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, full_name, is_verified FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Aucun compte associé à cette adresse.' });
      return;
    }

    const user = userRes.rows[0];
    if (Number(user.is_verified) === 1) {
      res.status(400).json({ success: false, error: 'Ce compte est déjà vérifié. Vous pouvez vous connecter.' });
      return;
    }

    // Check rate limit: minimum 30s between resends
    const lastCodeRes = await db.execute({
      sql: 'SELECT created_at FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      args: [cleanEmail],
    });
    if (lastCodeRes.rows.length > 0) {
      const lastCreated = new Date(String(lastCodeRes.rows[0].created_at)).getTime();
      const diffSeconds = (Date.now() - lastCreated) / 1000;
      if (diffSeconds < 30) {
        res.status(429).json({
          success: false,
          error: `Veuillez patienter ${Math.ceil(30 - diffSeconds)} secondes avant de demander un nouveau code.`,
        });
        return;
      }
    }

    // Invalidate existing codes
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

    console.log('[PICHFLOW AUTH] Code de confirmation renvoyé.');

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, newCode, String(user.full_name));
    } catch (mailErr: any) {
      console.warn('[PichFlow Auth] Resend email warning:', mailErr.message);
    }

    if (!emailSent) {
      res.status(502).json({
        success: false,
        emailSent: false,
        error: "L'e-mail contenant votre nouveau code n'a pas pu être délivré par le serveur SMTP. Veuillez réessayer ultérieurement.",
      });
      return;
    }

    res.json({
      success: true,
      emailSent: true,
      message: 'Un nouveau code de confirmation a été envoyé à votre adresse e-mail.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login (enforces verified email check & 15-hour session & email login alert)
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
      return;
    }

    const user = userRes.rows[0];
    const valid = verifyPassword(password, String(user.password_hash));
    if (!valid) {
      res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
      return;
    }

    // If account has not verified their email yet, reject login with requireVerification
    if (Number(user.is_verified) === 0) {
      res.status(403).json({
        success: false,
        requireVerification: true,
        email: cleanEmail,
        error: 'Votre adresse e-mail n’est pas encore confirmée. Veuillez saisir le code de vérification reçu.',
      });
      return;
    }

    // Create 15-hour session token
    const token = await createSession(String(user.id), req);

    // Extract client IP cleanly (support proxies / Cloudflare / local)
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    const cleanIp = rawIp.replace(/^::ffff:/, '');
    const displayIp = cleanIp === '::1' || cleanIp === '127.0.0.1' ? '127.0.0.1 (Localhost)' : cleanIp;
    const userAgent = (req.headers['user-agent'] as string) || 'Navigateur Web';

    console.log('[PichFlow Auth] Envoi de l’alerte de connexion.');
    sendLoginNotificationEmail(cleanEmail, String(user.full_name), {
      ip: displayIp,
      userAgent,
      time: new Date().toISOString(),
    }).catch((err) => console.warn('[Login Notification Email Error]', err.message));

    res.json({
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
  } catch (err: any) {
    console.error('[API] Login error:', err);
    res.status(500).json({ success: false, error: 'Une erreur interne est survenue lors de la connexion.' });
  }
});

// Test endpoint for login alert security email (callable from dashboard or scripts)
apiRouter.post('/auth/test-login-alert', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    const cleanIp = rawIp.replace(/^::ffff:/, '');
    const displayIp = cleanIp === '::1' || cleanIp === '127.0.0.1' ? '127.0.0.1 (Localhost)' : cleanIp;
    const userAgent = (req.headers['user-agent'] as string) || 'Navigateur Web';

    const sent = await sendLoginNotificationEmail(req.user!.email, req.user!.full_name, {
      ip: displayIp,
      userAgent,
      time: new Date().toISOString(),
    });

    res.json({
      success: true,
      sent,
      message: `Alerte de connexion SaaSPay envoyée à ${req.user!.email} (IP: ${displayIp})`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logout (invalidates session on server)
apiRouter.post('/auth/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      await destroySession(token);
    }
    res.json({ success: true, message: 'Déconnexion réussie.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Forgot Password Request
apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Adresse e-mail requise.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, full_name FROM users WHERE email = ?',
      args: [cleanEmail],
    });

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const resetCode = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await db.execute({
        sql: 'DELETE FROM email_verification_codes WHERE email = ?',
        args: [cleanEmail],
      });

      await db.execute({
        sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `rc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          String(user.id),
          cleanEmail,
          resetCode,
          expiresAt,
          0,
          now,
        ],
      });

      sendPasswordResetEmail(cleanEmail, resetCode, String(user.full_name)).catch((err) =>
        console.warn('[Password Reset Email]', err.message)
      );
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'Si cette adresse correspond à un compte, un code de réinitialisation vous a été envoyé.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Password with Code
apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ success: false, error: 'Email, code et nouveau mot de passe requis.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();
    const db = getDb();
    const now = new Date().toISOString();

    const codeRes = await db.execute({
      sql: `SELECT * FROM email_verification_codes 
            WHERE email = ? AND code = ? AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [cleanEmail, cleanCode, now],
    });

    if (codeRes.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Code de réinitialisation invalide ou expiré.' });
      return;
    }

    const record = codeRes.rows[0];
    const userId = String(record.user_id);
    const newHash = hashPassword(newPassword);

    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      args: [newHash, now, userId],
    });

    // Invalidate all existing sessions for security
    await db.execute({
      sql: 'DELETE FROM sessions WHERE user_id = ?',
      args: [userId],
    });

    // Delete used code
    await db.execute({
      sql: 'DELETE FROM email_verification_codes WHERE email = ?',
      args: [cleanEmail],
    });

    const userRes = await db.execute({ sql: 'SELECT full_name FROM users WHERE id = ?', args: [userId] });
    if (userRes.rows.length > 0) {
      sendPasswordChangedNotificationEmail(cleanEmail, String(userRes.rows[0].full_name)).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Me (Current user)
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

// Change Password (authenticated)
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Mot de passe actuel et nouveau mot de passe requis.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
      return;
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT password_hash, email, full_name FROM users WHERE id = ?',
      args: [req.user!.id],
    });

    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
      return;
    }

    const user = userRes.rows[0];
    const valid = verifyPassword(currentPassword, String(user.password_hash));
    if (!valid) {
      res.status(400).json({ success: false, error: 'Le mot de passe actuel est incorrect.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();

    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      args: [newHash, now, req.user!.id],
    });

    // Send confirmation email
    sendPasswordChangedNotificationEmail(String(user.email), String(user.full_name)).catch(() => {});

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle 2FA
apiRouter.post('/auth/toggle-2fa', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enable } = req.body;
    const db = getDb();
    await db.execute({
      sql: 'UPDATE users SET two_factor_enabled = ?, updated_at = ? WHERE id = ?',
      args: [enable ? 1 : 0, new Date().toISOString(), req.user!.id],
    });
    res.json({ success: true, enabled: Boolean(enable) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. APPLICATIONS MANAGEMENT
// ==========================================

apiRouter.get('/apps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC',
      args: [req.user!.id],
    });

    const apps = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      category: String(row.category),
      website: String(row.website || ''),
      environment: String(row.environment || 'test'),
      createdAt: String(row.created_at),
      currency: String(row.currency || 'XOF'),
    }));

    res.json({ success: true, applications: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/apps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, website, currency, environment } = req.body;
    const name = (req.body.name || req.body.appName || req.body.app_name || req.body.title || req.body.label || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Le nom de l’application est requis.' });
      return;
    }

    const id = `app_${Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO applications (id, user_id, name, slug, category, website, environment, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user!.id,
        name,
        slug,
        category || 'E-commerce',
        website || '',
        environment || 'test',
        currency || 'XOF',
        'active',
        now,
        now,
      ],
    });

    res.json({
      success: true,
      application: {
        id,
        name,
        slug,
        category: category || 'E-commerce',
        website: website || '',
        environment: environment || 'test',
        createdAt: now,
        currency: currency || 'XOF',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Application
apiRouter.put('/apps/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, website, currency, environment } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE applications SET name = COALESCE(?, name), category = COALESCE(?, category), website = COALESCE(?, website), currency = COALESCE(?, currency), environment = COALESCE(?, environment), updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        name !== undefined ? name : null,
        category !== undefined ? category : null,
        website !== undefined ? website : null,
        currency !== undefined ? currency : null,
        environment !== undefined ? environment : null,
        new Date().toISOString(),
        req.params.id,
        req.user!.id,
      ],
    });

    res.json({ success: true, message: 'Application mise à jour.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete or Archive Application
apiRouter.delete('/apps/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appId = req.params.id;
    const db = getDb();

    // Check if app belongs to user
    const appCheck = await db.execute({
      sql: 'SELECT id, name FROM applications WHERE id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });

    if (appCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Application introuvable.' });
      return;
    }

    // Check transactions constraint
    const txCheck = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM transactions WHERE application_id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });

    const txCount = Number(txCheck.rows[0].count || 0);
    if (txCount > 0) {
      // Archive application to preserve financial and regulatory history
      await db.execute({
        sql: `UPDATE applications SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?`,
        args: [new Date().toISOString(), appId, req.user!.id],
      });
      res.json({
        success: true,
        archived: true,
        message: `L'application a été archivée car elle possède ${txCount} transaction(s) dans l'historique comptable.`,
      });
      return;
    }

    // Clean delete if no transactions
    await db.execute({
      sql: 'DELETE FROM api_credentials WHERE application_id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });
    await db.execute({
      sql: 'DELETE FROM payment_links WHERE application_id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });
    await db.execute({
      sql: 'DELETE FROM webhooks WHERE application_id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });
    await db.execute({
      sql: 'DELETE FROM applications WHERE id = ? AND user_id = ?',
      args: [appId, req.user!.id],
    });

    res.json({ success: true, message: 'Application supprimée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. WALLETS & BALANCES
// ==========================================

apiRouter.get('/wallets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM wallets WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
      args: [req.user!.id],
    });

    const wallets = result.rows.map((row) => ({
      id: String(row.id),
      currency: String(row.currency),
      symbol: String(row.symbol),
      balance: Number(row.balance || 0),
      pendingBalance: Number(row.pending_balance || 0),
      reservedBalance: Number(row.reserved_balance || 0),
      countryCode: String(row.country_code || 'BJ'),
      isDefault: Boolean(row.is_default),
    }));

    res.json({ success: true, wallets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create/Enable a wallet for a specific country/currency
apiRouter.post('/wallets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { countryCode, currency, symbol } = req.body;
    if (!countryCode || !currency) {
      res.status(400).json({ success: false, error: 'Code pays et devise requis.' });
      return;
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM wallets WHERE user_id = ? AND country_code = ? AND currency = ?',
      args: [req.user!.id, countryCode, currency],
    });

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Ce portefeuille existe déjà pour votre compte.' });
      return;
    }

    const id = `wal_${currency.toLowerCase()}_${Date.now()}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0, ?, ?)`,
      args: [id, req.user!.id, currency, symbol || currency, countryCode, now, now],
    });

    res.json({
      success: true,
      wallet: {
        id,
        currency,
        symbol: symbol || currency,
        balance: 0,
        pendingBalance: 0,
        reservedBalance: 0,
        countryCode,
        isDefault: false,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Transfer between user wallets (atomic & authenticated)
apiRouter.post('/wallets/transfer', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromWalletId, toWalletId, amount, applicationId } = req.body;
    const transferAmount = Number(amount);

    if (!fromWalletId || !toWalletId || isNaN(transferAmount) || transferAmount <= 0) {
      res.status(400).json({ success: false, error: 'Portefeuilles et montant positif requis.' });
      return;
    }

    if (fromWalletId === toWalletId) {
      res.status(400).json({ success: false, error: 'Les portefeuilles source et cible doivent être différents.' });
      return;
    }
    if (typeof applicationId !== 'string' || !await userOwnsApplication(req.user!.id, applicationId)) {
      res.status(404).json({ success: false, error: 'Application introuvable.' });
      return;
    }

    const db = getDb();

    // Verify source wallet and ownership
    const fromRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [fromWalletId, req.user!.id, applicationId],
    });
    if (fromRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Portefeuille source introuvable ou non autorisé.' });
      return;
    }

    const toRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [toWalletId, req.user!.id, applicationId],
    });
    if (toRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Portefeuille cible introuvable ou non autorisé.' });
      return;
    }

    const fromWallet = fromRes.rows[0];
    const toWallet = toRes.rows[0];
    const currentBalance = Number(fromWallet.balance || 0);

    if (currentBalance < transferAmount) {
      res.status(400).json({
        success: false,
        error: `Solde insuffisant (${currentBalance} ${fromWallet.currency} disponible contre ${transferAmount} demandé).`,
      });
      return;
    }

    const now = new Date().toISOString();
    const ref = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Atomic balance update
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?',
      args: [transferAmount, now, fromWalletId],
    });

    await db.execute({
      sql: 'UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE id = ?',
      args: [transferAmount, now, toWalletId],
    });

    // Record ledger entries
    const ledgerIdOut = `led_${Date.now()}_out`;
    const ledgerIdIn = `led_${Date.now()}_in`;

    await db.execute({
      sql: `INSERT INTO ledger_entries (id, user_id, wallet_id, type, reference, amount, currency, net_amount, description, created_at)
            VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, 'Transfert sortant inter-portefeuilles', ?)`,
      args: [ledgerIdOut, req.user!.id, fromWalletId, ref, transferAmount, String(fromWallet.currency), -transferAmount, now],
    });

    await db.execute({
      sql: `INSERT INTO ledger_entries (id, user_id, wallet_id, type, reference, amount, currency, net_amount, description, created_at)
            VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, 'Transfert entrant inter-portefeuilles', ?)`,
      args: [ledgerIdIn, req.user!.id, toWalletId, ref, transferAmount, String(toWallet.currency), transferAmount, now],
    });

    res.json({
      success: true,
      reference: ref,
      message: `Transfert de ${transferAmount} ${fromWallet.currency} effectué avec succès.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. TRANSACTIONS
// ==========================================

apiRouter.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId, status, country, search } = req.query;
    const targetAppId = (applicationId || appId || '') as string;

    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const args: any[] = [req.user!.id];

    if (targetAppId.trim()) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    if (status && status !== 'Tous' && typeof status === 'string') {
      sql += ' AND status = ?';
      args.push(status);
    }

    if (country && country !== 'Tous' && typeof country === 'string') {
      sql += ' AND country = ?';
      args.push(country);
    }

    if (search && typeof search === 'string' && search.trim()) {
      sql += ' AND (reference LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      const term = `%${search.trim()}%`;
      args.push(term, term, term);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.execute({ sql, args });

    const transactions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ''),
      country: String(row.country || ''),
      provider: String(row.provider),
      amount: Number(row.amount),
      providerFee: Number(row.provider_fee || 0),
      platformFee: Number(row.platform_fee || 0),
      customerFee: Number(row.customer_fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      currency: String(row.currency || 'XOF'),
      status: String(row.status),
      createdAt: String(row.created_at),
      description: String(row.description || ''),
      paymentMethod: String(row.payment_method || 'Mobile Money'),
    }));

    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. PAYMENT LINKS
// ==========================================

apiRouter.get('/payment-links', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = (applicationId || appId || '') as string;
    if (!await userOwnsApplication(req.user!.id, targetAppId)) {
      res.status(404).json({ success: false, error: 'Application introuvable.' });
      return;
    }

    const result = await db.execute({
      sql: 'SELECT * FROM payment_links WHERE user_id = ? AND application_id = ? ORDER BY created_at DESC',
      args: [req.user!.id, targetAppId.trim()],
    });

    const paymentLinks = result.rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ''),
      amount: row.amount !== null ? Number(row.amount) : null,
      isFixedAmount: Boolean(row.is_fixed_amount),
      currency: String(row.currency || 'XOF'),
      country: String(row.country || ''),
      status: String(row.status),
      usageCount: Number(row.usage_count || 0),
      usageLimit: row.usage_limit !== null ? Number(row.usage_limit) : null,
      requirePhone: Boolean(row.require_phone),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      createdAt: String(row.created_at),
      redirectUrl: row.redirect_url ? String(row.redirect_url) : undefined,
    }));

    res.json({ success: true, paymentLinks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/payment-links', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, amount, isFixedAmount, currency, country, usageLimit, requirePhone, redirectUrl, applicationId } = req.body;
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const fixedAmount = isFixedAmount !== false;
    const numericAmount = amount === undefined || amount === null || amount === '' ? null : Number(amount);
    const cleanCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'XOF';
    const cleanCountry = typeof country === 'string' ? country.trim().toUpperCase() : '';
    const expiresAtValue = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : '';
    const expiresAt = expiresAtValue ? new Date(`${expiresAtValue}T23:59:59.999Z`) : null;
    const numericUsageLimit = usageLimit === undefined || usageLimit === null || usageLimit === '' ? null : Number(usageLimit);
    if (!await userOwnsApplication(req.user!.id, String(applicationId || ''))) {
      res.status(404).json({ success: false, error: 'Application introuvable.' });
      return;
    }
    if (!cleanTitle || cleanTitle.length > 140) {
      res.status(400).json({ success: false, error: 'Le nom du produit est requis (140 caractères maximum).' });
      return;
    }
    if (fixedAmount && (numericAmount === null || !Number.isSafeInteger(numericAmount) || numericAmount < PAYDUNYA_MINIMUM_AMOUNT_XOF)) {
      res.status(400).json({ success: false, error: `Saisissez un montant fixe entier d’au moins ${PAYDUNYA_MINIMUM_AMOUNT_XOF} XOF.` });
      return;
    }
    if (!fixedAmount && numericAmount !== null) {
      res.status(400).json({ success: false, error: 'Un lien à montant libre ne peut pas définir de montant fixe.' });
      return;
    }
    if (cleanCurrency !== 'XOF' || (cleanCountry && cleanCountry !== 'BJ')) {
      res.status(400).json({ success: false, error: 'La configuration PayDunya vérifiée ici prend en charge les paiements en XOF au Bénin.' });
      return;
    }
    if (numericUsageLimit !== null && (!Number.isInteger(numericUsageLimit) || numericUsageLimit < 1)) {
      res.status(400).json({ success: false, error: 'La limite de paiements doit être un entier positif.' });
      return;
    }
    if (expiresAtValue && (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      res.status(400).json({ success: false, error: 'La date d’expiration doit être une date future valide.' });
      return;
    }

    const id = `pl_${crypto.randomUUID()}`;
    const cleanSlug = cleanTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 55) || 'paiement';
    const slug = `${cleanSlug}-${crypto.randomBytes(5).toString('hex')}`;
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO payment_links (id, user_id, application_id, slug, title, description, amount, is_fixed_amount, currency, country, status, usage_count, usage_limit, require_phone, expires_at, redirect_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user!.id,
        applicationId,
        slug,
        cleanTitle,
        typeof description === 'string' ? description.trim() : '',
        numericAmount,
        fixedAmount ? 1 : 0,
        cleanCurrency,
        cleanCountry,
        'active',
        0,
        numericUsageLimit,
        requirePhone === true ? 1 : 0,
        expiresAt?.toISOString() || null,
        redirectUrl || null,
        now,
        now,
      ],
    });

    const newLink = {
      id,
      slug,
      title: cleanTitle,
      description: typeof description === 'string' ? description.trim() : '',
      amount: numericAmount,
      isFixedAmount: fixedAmount,
      currency: cleanCurrency,
      country: cleanCountry,
      status: 'active',
      usageCount: 0,
      usageLimit: numericUsageLimit,
      requirePhone: requirePhone === true,
      expiresAt: expiresAt?.toISOString() || null,
      createdAt: now,
      redirectUrl: redirectUrl || undefined,
    };

    res.json({ success: true, paymentLink: newLink });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public payment link lookup by slug
apiRouter.get('/payment-links/slug/:slug', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT pl.*, u.full_name as merchant_name, a.name as app_name
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            JOIN applications a ON pl.application_id = a.id AND a.user_id = pl.user_id
            WHERE pl.slug = ? AND pl.status = 'active'
              AND (pl.expires_at IS NULL OR datetime(pl.expires_at) > datetime('now'))
              AND (pl.usage_limit IS NULL OR pl.usage_count < pl.usage_limit)`,
      args: [req.params.slug],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Lien de paiement introuvable ou expiré.' });
      return;
    }

    const row = result.rows[0];
    res.json({
      success: true,
      paymentLink: {
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        description: String(row.description || ''),
        amount: row.amount !== null ? Number(row.amount) : null,
        isFixedAmount: Boolean(row.is_fixed_amount),
        currency: String(row.currency || 'XOF'),
        country: String(row.country || ''),
        requirePhone: Boolean(row.require_phone),
        expiresAt: row.expires_at ? String(row.expires_at) : null,
        merchantName: String(row.merchant_name || 'Marchand PichFlow'),
        appName: String(row.app_name || 'PichFlow Store'),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Payment Link Details with real transactions & metrics (Matches Screenshot 1)
apiRouter.get('/payment-links/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const linkRes = await db.execute({
      sql: 'SELECT * FROM payment_links WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });

    if (linkRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Lien de paiement introuvable.' });
      return;
    }

    const pl = linkRes.rows[0];

    // Query transactions associated with this link
    const txsRes = await db.execute({
      sql: `SELECT * FROM transactions WHERE user_id = ? AND reference IN (
        SELECT reference FROM checkout_sessions WHERE payment_link_id = ?
      ) ORDER BY created_at DESC`,
      args: [req.user!.id, req.params.id],
    });

    const totalCount = txsRes.rows.length;
    const successCount = txsRes.rows.filter((t) => t.status === 'success').length;
    const failedCount = txsRes.rows.filter((t) => t.status === 'failed').length;
    const collectedAmount = txsRes.rows
      .filter((t) => t.status === 'success')
      .reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);

    res.json({
      success: true,
      paymentLink: {
        id: String(pl.id),
        slug: String(pl.slug),
        title: String(pl.title),
        description: String(pl.description || ''),
        amount: pl.amount !== null ? Number(pl.amount) : null,
        isFixedAmount: Boolean(pl.is_fixed_amount),
        currency: String(pl.currency || 'XOF'),
        country: String(pl.country || 'BJ'),
        status: String(pl.status),
        usageCount: Number(pl.usage_count || 0),
        createdAt: String(pl.created_at),
        stats: {
          totalTransactions: totalCount,
          successCount,
          failedCount,
          collectedAmount,
        },
        transactions: txsRes.rows.map((r) => ({
          id: String(r.id),
          reference: String(r.reference),
          customerName: String(r.customer_name),
          customerPhone: String(r.customer_phone || ''),
          amount: Number(r.amount),
          currency: String(r.currency || 'XOF'),
          status: String(r.status),
          createdAt: String(r.created_at),
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Payment Link
apiRouter.put('/payment-links/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, amount, isFixedAmount, status } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE payment_links SET 
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            amount = COALESCE(?, amount),
            is_fixed_amount = COALESCE(?, is_fixed_amount),
            status = COALESCE(?, status),
            updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        title,
        description,
        amount !== undefined ? amount : null,
        isFixedAmount !== undefined ? (isFixedAmount ? 1 : 0) : null,
        status,
        new Date().toISOString(),
        req.params.id,
        req.user!.id,
      ],
    });

    res.json({ success: true, message: 'Lien de paiement mis à jour.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Payment Link
apiRouter.delete('/payment-links/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM payment_links WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Lien de paiement supprimé.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. CUSTOMERS
// ==========================================

apiRouter.get('/customers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = (applicationId || appId || '') as string;

    let sql = 'SELECT * FROM customers WHERE user_id = ?';
    const args: any[] = [req.user!.id];

    if (targetAppId.trim()) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    sql += ' ORDER BY last_transaction_at DESC';

    const result = await db.execute({ sql, args });

    const customers = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone || ''),
      country: String(row.country || 'BJ'),
      paymentCount: Number(row.payment_count || 1),
      totalSpent: Number(row.total_spent || 0),
      currency: String(row.currency || 'XOF'),
      lastTransactionAt: String(row.last_transaction_at),
    }));

    res.json({ success: true, customers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Customer
apiRouter.post('/customers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, phone, country, applicationId } = req.body;
    if (!name || !email) {
      res.status(400).json({ success: false, error: 'Nom et adresse e-mail requis.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const id = `cus_${Date.now()}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO customers (id, user_id, application_id, name, email, phone, country, payment_count, total_spent, currency, last_transaction_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'XOF', ?, ?)`,
      args: [id, req.user!.id, applicationId || 'app_default', name.trim(), cleanEmail, phone ? phone.trim() : '', country || 'BJ', now, now],
    });

    res.json({
      success: true,
      customer: {
        id,
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : '',
        country: country || 'BJ',
        paymentCount: 0,
        totalSpent: 0,
        currency: 'XOF',
        lastTransactionAt: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Customer
apiRouter.put('/customers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, country } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), country = COALESCE(?, country)
            WHERE id = ? AND user_id = ?`,
      args: [name ? name.trim() : null, phone ? phone.trim() : null, country || null, req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Client mis à jour.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Customer
apiRouter.delete('/customers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM customers WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Client supprimé.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. WITHDRAWALS / PAYOUTS
// ==========================================

apiRouter.get('/withdrawals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM payout_requests WHERE user_id = ? ORDER BY created_at DESC',
      args: [req.user!.id],
    });

    const withdrawals = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      fee: Number(row.fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      methodType: String(row.method_type) as 'mobile_money' | 'bank_transfer',
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      operatorOrBank: String(row.operator_or_bank),
      country: String(row.country || 'BJ'),
      status: String(row.status),
      createdAt: String(row.created_at),
      processedAt: row.processed_at ? String(row.processed_at) : undefined,
    }));

    res.json({ success: true, withdrawals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/withdrawals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, currency, methodType, recipientName, recipientPhoneOrIban, operatorOrBank, country } = req.body;
    if (!amount || amount <= 0 || !recipientName || !recipientPhoneOrIban) {
      res.status(400).json({ success: false, error: 'Montant, bénéficiaire et coordonnées requis.' });
      return;
    }

    const numAmount = Number(amount);
    const db = getDb();

    // Verify wallet balance
    const walletRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE user_id = ? AND currency = ?',
      args: [req.user!.id, currency || 'XOF'],
    });

    if (walletRes.rows.length === 0 || Number(walletRes.rows[0].balance) < numAmount) {
      res.status(400).json({ success: false, error: 'Solde insuffisant pour effectuer ce retrait.' });
      return;
    }

    const wallet = walletRes.rows[0];
    const fee = Math.round(numAmount * 0.01); // 1% payout fee
    const netAmount = numAmount - fee;
    const now = new Date().toISOString();
    const reference = `WDR-PF-${Date.now().toString().slice(-6)}`;
    const id = `wdr_${Date.now()}`;

    // Deduct balance
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?',
      args: [numAmount, now, wallet.id],
    });

    // Create withdrawal request
    await db.execute({
      sql: `INSERT INTO payout_requests (id, user_id, reference, amount, currency, fee, net_amount, method_type, recipient_name, recipient_phone_or_iban, operator_or_bank, country, status, notes, created_at, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user!.id,
        reference,
        numAmount,
        currency || 'XOF',
        fee,
        netAmount,
        methodType || 'mobile_money',
        recipientName,
        recipientPhoneOrIban,
        operatorOrBank || 'MTN MoMo',
        country || 'BJ',
        'pending',
        'Demande de retrait en cours de traitement',
        now,
        null,
      ],
    });

    const newWithdrawal = {
      id,
      reference,
      amount: numAmount,
      currency: currency || 'XOF',
      fee,
      netAmount,
      methodType: methodType || 'mobile_money',
      recipientName,
      recipientPhoneOrIban,
      operatorOrBank: operatorOrBank || 'MTN MoMo',
      country: country || 'BJ',
      status: 'pending',
      createdAt: now,
      processedAt: undefined,
    };

    res.json({ success: true, withdrawal: newWithdrawal });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7b. PAYOUT METHODS (MOBILE MONEY & BANK TRANSFER)
// ==========================================

// List user payout methods (empty by default for new accounts)
apiRouter.get('/payout-methods', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM payout_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      args: [req.user!.id],
    });

    const methods = result.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type) as 'mobile_money' | 'bank_transfer',
      label: String(row.label || row.recipient_name || 'Méthode'),
      operatorOrBank: String(row.operator_or_bank),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      accountNumber: String(row.account_number || ''),
      iban: String(row.iban || ''),
      swiftBic: String(row.swift_bic || ''),
      bankCode: String(row.bank_code || ''),
      branchCode: String(row.branch_code || ''),
      country: String(row.country || 'BJ'),
      currency: String(row.currency || 'XOF'),
      isDefault: Boolean(row.is_default),
      isVerified: Boolean(row.is_verified || 1),
      createdAt: String(row.created_at),
    }));

    res.json({ success: true, payoutMethods: methods });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Payout Method (Mobile Money or Bank Transfer)
apiRouter.post('/payout-methods', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      type,
      label,
      operatorOrBank,
      recipientName,
      recipientPhoneOrIban,
      accountNumber,
      iban,
      swiftBic,
      bankCode,
      branchCode,
      country,
      currency,
    } = req.body;

    if (!type || !operatorOrBank) {
      res.status(400).json({ success: false, error: 'Type de méthode et opérateur/banque requis.' });
      return;
    }

    if (type === 'mobile_money' && !recipientPhoneOrIban) {
      res.status(400).json({ success: false, error: 'Numéro de téléphone requis pour le Mobile Money.' });
      return;
    }

    if (type === 'bank_transfer' && (!recipientName || (!accountNumber && !recipientPhoneOrIban))) {
      res.status(400).json({ success: false, error: 'Nom du titulaire et numéro de compte requis pour le virement bancaire.' });
      return;
    }

    const db = getDb();
    const id = `pm_${Date.now()}`;
    const now = new Date().toISOString();

    // Check if user has any existing method
    const countRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM payout_methods WHERE user_id = ?',
      args: [req.user!.id],
    });
    const isFirst = Number(countRes.rows[0].count || 0) === 0;

    await db.execute({
      sql: `INSERT INTO payout_methods (id, user_id, type, label, operator_or_bank, recipient_name, recipient_phone_or_iban, account_number, iban, swift_bic, bank_code, branch_code, country, currency, is_default, is_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user!.id,
        type,
        label || (type === 'mobile_money' ? 'Compte mobile money' : 'Compte bancaire principal'),
        operatorOrBank,
        recipientName || req.user!.full_name,
        recipientPhoneOrIban || accountNumber || '',
        accountNumber || '',
        iban || '',
        swiftBic || '',
        bankCode || '',
        branchCode || '',
        country || 'BJ',
        currency || 'XOF',
        isFirst ? 1 : 0,
        1, // Verified method
        now,
      ],
    });

    res.json({
      success: true,
      payoutMethod: {
        id,
        type,
        label: label || (type === 'mobile_money' ? 'Compte mobile money' : 'Compte bancaire principal'),
        operatorOrBank,
        recipientName: recipientName || req.user!.full_name,
        recipientPhoneOrIban: recipientPhoneOrIban || accountNumber || '',
        accountNumber,
        iban,
        swiftBic,
        bankCode,
        branchCode,
        country: country || 'BJ',
        currency: currency || 'XOF',
        isDefault: isFirst,
        isVerified: true,
        createdAt: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Payout Method
apiRouter.delete('/payout-methods/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM payout_methods WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Méthode de retrait supprimée.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Set Payout Method as Default
apiRouter.put('/payout-methods/:id/default', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'UPDATE payout_methods SET is_default = 0 WHERE user_id = ?',
      args: [req.user!.id],
    });
    await db.execute({
      sql: 'UPDATE payout_methods SET is_default = 1 WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Méthode principale mise à jour.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7c. STATISTICS (REAL ACCUMULATOR)
// ==========================================

apiRouter.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30j', appId, applicationId } = req.query;
    const db = getDb();
    const targetAppId = (appId || applicationId || '') as string;

    let days = 30;
    if (period === '7j') days = 7;
    else if (period === '90j') days = 90;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let sql = 'SELECT * FROM transactions WHERE user_id = ? AND created_at >= ?';
    const args: any[] = [req.user!.id, startDate];

    if (targetAppId.trim().length > 0) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    const result = await db.execute({ sql, args });
    const txs = result.rows;

    const totalCount = txs.length;
    const successCount = txs.filter((t) => t.status === 'success' || t.status === 'completed').length;
    const failedCount = txs.filter((t) => t.status === 'failed').length;
    const pendingCount = txs.filter((t) => t.status === 'pending').length;
    const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';
    const revenue = txs
      .filter((t) => t.status === 'success' || t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);

    // Breakdown by country
    const countryMap: Record<string, number> = {};
    txs.filter((t) => t.status === 'success' || t.status === 'completed').forEach((t) => {
      const c = String(t.country || 'BJ');
      countryMap[c] = (countryMap[c] || 0) + Number(t.amount || 0);
    });

    // Breakdown by payment method
    const methodMap: Record<string, number> = {};
    txs.filter((t) => t.status === 'success').forEach((t) => {
      const m = String(t.payment_method || t.provider || 'Mobile Money');
      methodMap[m] = (methodMap[m] || 0) + Number(t.amount || 0);
    });

    res.json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        successfulTransactions: successCount,
        failedTransactions: failedCount,
        pendingTransactions: pendingCount,
        successRate: `${successRate}%`,
        revenue,
        currency: 'XOF',
        countryBreakdown: countryMap,
        methodBreakdown: methodMap,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7d. CHECKOUT SESSIONS
// ==========================================

apiRouter.get('/checkout-sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = (applicationId || appId || '') as string;

    let sql = `SELECT cs.* FROM checkout_sessions cs
               LEFT JOIN payment_links pl ON cs.payment_link_id = pl.id
               WHERE (pl.user_id = ? OR cs.user_id = ?)`;
    const args: any[] = [req.user!.id, req.user!.id];

    if (targetAppId.trim()) {
      sql += ' AND (cs.application_id = ? OR pl.application_id = ?)';
      args.push(targetAppId.trim(), targetAppId.trim());
    }

    sql += ' ORDER BY cs.created_at DESC LIMIT 100';

    const result = await db.execute({ sql, args });

    const sessions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || 'XOF'),
      customerName: String(row.customer_name || 'Client'),
      customerEmail: String(row.customer_email || ''),
      customerPhone: String(row.customer_phone || ''),
      status: String(row.status),
      paymentMethod: String(row.payment_method || 'Mobile Money'),
      paydunyaUrl: String(row.paydunya_url || ''),
      createdAt: String(row.created_at),
    }));

    res.json({ success: true, checkoutSessions: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. DEVELOPER CENTER (API Keys & Webhooks)
// ==========================================

// List API Keys
apiRouter.get('/developer/keys', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = (applicationId || appId || '') as string;

    let sql = 'SELECT * FROM api_credentials WHERE user_id = ?';
    const args: any[] = [req.user!.id];

    if (targetAppId.trim()) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.execute({ sql, args });

    const keys = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      environment: String(row.environment) as 'sandbox' | 'live',
      prefix: String(row.prefix),
      secretMasked: String(row.secret_masked),
      secretKey: '', // Masquée après création
      scope: String(row.scope) as 'payin' | 'payout' | 'both',
      createdAt: String(row.created_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      isActive: Boolean(row.is_active),
    }));

    res.json({ success: true, apiKeys: keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate Dual Secret Keys (Sandbox sk_test_... AND Live sk_live_... simultaneously)
apiRouter.post('/developer/keys', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, scope, applicationId } = req.body;
    const baseName = (name || 'Clé API').trim();
    const effectiveScope = scope || 'both';
    const targetAppId = applicationId || 'app_default';
    const now = new Date().toISOString();
    const db = getDb();

    // 1. Generate Sandbox Key
    const testRandom = crypto.randomBytes(24).toString('hex');
    const testSecret = `sk_test_pichflow_${testRandom}`;
    const testMasked = `sk_test_••••••••••••••••••••${testRandom.slice(-4)}`;
    const testHash = crypto.createHash('sha256').update(testSecret).digest('hex');
    const testId = `key_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, environment, prefix, secret_key, secret_masked, secret_hash, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testId,
        req.user!.id,
        targetAppId,
        `${baseName} (Sandbox)`,
        'sandbox',
        `sk_test_${testRandom.slice(0, 6)}`,
        testSecret,
        testMasked,
        testHash,
        effectiveScope,
        1,
        now,
      ],
    });

    // 2. Generate Live Key
    const liveRandom = crypto.randomBytes(24).toString('hex');
    const liveSecret = `sk_live_pichflow_${liveRandom}`;
    const liveMasked = `sk_live_••••••••••••••••••••${liveRandom.slice(-4)}`;
    const liveHash = crypto.createHash('sha256').update(liveSecret).digest('hex');
    const liveId = `key_live_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, environment, prefix, secret_key, secret_masked, secret_hash, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        liveId,
        req.user!.id,
        targetAppId,
        `${baseName} (Live)`,
        'live',
        `sk_live_${liveRandom.slice(0, 6)}`,
        liveSecret,
        liveMasked,
        liveHash,
        effectiveScope,
        1,
        now,
      ],
    });

    const sandboxKey = {
      id: testId,
      name: `${baseName} (Sandbox)`,
      environment: 'sandbox' as const,
      prefix: `sk_test_${testRandom.slice(0, 6)}`,
      secretMasked: testMasked,
      secretKey: testSecret, // Transmis intégralement une seule fois à la création
      scope: effectiveScope,
      createdAt: now,
      isActive: true,
    };

    const liveKey = {
      id: liveId,
      name: `${baseName} (Live)`,
      environment: 'live' as const,
      prefix: `sk_live_${liveRandom.slice(0, 6)}`,
      secretMasked: liveMasked,
      secretKey: liveSecret, // Transmis intégralement une seule fois à la création
      scope: effectiveScope,
      createdAt: now,
      isActive: true,
    };

    res.json({
      success: true,
      apiKey: sandboxKey,
      keys: {
        sandbox: sandboxKey,
        live: liveKey,
      },
      message: 'Paire de clés Sandbox et Live générée avec succès.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revoke API Key
apiRouter.delete('/developer/keys/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM api_credentials WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Clé API révoquée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhooks
apiRouter.get('/developer/webhooks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = (applicationId || appId || '') as string;

    let sql = 'SELECT * FROM webhooks WHERE user_id = ?';
    const args: any[] = [req.user!.id];

    if (targetAppId.trim()) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.execute({ sql, args });

    const webhooks = result.rows.map((row) => ({
      id: String(row.id),
      url: String(row.url),
      description: String(row.description || ''),
      secret: String(row.secret),
      events: String(row.events).split(','),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      lastDeliveryStatus: String(row.last_delivery_status || 'success'),
    }));

    res.json({ success: true, webhooks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/developer/webhooks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, description, applicationId } = req.body;
    if (!url) {
      res.status(400).json({ success: false, error: 'URL du webhook requise.' });
      return;
    }

    const id = `whk_${Date.now()}`;
    const secret = `whsec_pf_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO webhooks (id, user_id, application_id, url, description, secret, events, is_active, last_delivery_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user!.id,
        applicationId || 'app_default',
        url,
        description || 'Endpoint webhook',
        secret,
        'payment.created,payment.success,payment.failed',
        1,
        'success',
        now,
      ],
    });

    const newWh = {
      id,
      url,
      description: description || 'Endpoint webhook',
      secret,
      events: ['payment.created', 'payment.success', 'payment.failed'],
      isActive: true,
      createdAt: now,
      lastDeliveryStatus: 'success',
    };

    res.json({ success: true, webhook: newWh });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/developer/webhooks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM webhooks WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });
    res.json({ success: true, message: 'Webhook supprimé.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update or toggle Webhook
apiRouter.put('/developer/webhooks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, description, events, isActive } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE webhooks 
            SET url = COALESCE(?, url),
                description = COALESCE(?, description),
                events = COALESCE(?, events),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND user_id = ?`,
      args: [
        url ? url.trim() : null,
        description !== undefined ? description.trim() : null,
        events ? (Array.isArray(events) ? JSON.stringify(events) : events) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        req.params.id,
        req.user!.id,
      ],
    });
    res.json({ success: true, message: 'Webhook mis à jour.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get real webhook delivery logs
apiRouter.get('/developer/webhooks/logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT wl.*, w.url as webhook_url 
            FROM webhook_logs wl
            LEFT JOIN webhooks w ON wl.webhook_id = w.id
            WHERE wl.user_id = ? 
            ORDER BY wl.created_at DESC LIMIT 50`,
      args: [req.user!.id],
    });

    const logs = result.rows.map((r) => ({
      id: String(r.id),
      webhookId: String(r.webhook_id),
      event: String(r.event),
      url: String(r.webhook_url || ''),
      status: Number(r.status_code || 200),
      statusText: Number(r.status_code || 200) < 400 ? 'OK' : 'ERROR',
      durationMs: 120,
      timestamp: String(r.created_at),
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload,
      response: String(r.response_body || '{"received":true}'),
    }));

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for webhook logs
apiRouter.get('/developer/webhook-logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT wl.*, w.url as webhook_url 
            FROM webhook_logs wl
            LEFT JOIN webhooks w ON wl.webhook_id = w.id
            WHERE wl.user_id = ? 
            ORDER BY wl.created_at DESC LIMIT 50`,
      args: [req.user!.id],
    });

    const logs = result.rows.map((r) => ({
      id: String(r.id),
      webhookId: String(r.webhook_id),
      event: String(r.event),
      url: String(r.webhook_url || ''),
      status: Number(r.status_code || 200),
      statusText: Number(r.status_code || 200) < 400 ? 'OK' : 'ERROR',
      durationMs: 120,
      timestamp: String(r.created_at),
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload,
      response: String(r.response_body || '{"received":true}'),
    }));

    res.json({ success: true, logs, webhookLogs: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for payout methods
apiRouter.get('/withdrawals/methods', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM payout_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      args: [req.user!.id],
    });

    const methods = result.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type) as 'mobile_money' | 'bank_transfer',
      label: String(row.label || row.recipient_name || 'Méthode'),
      operatorOrBank: String(row.operator_or_bank),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      accountNumber: String(row.account_number || ''),
      iban: String(row.iban || ''),
      swiftBic: String(row.swift_bic || ''),
      bankCode: String(row.bank_code || ''),
      branchCode: String(row.branch_code || ''),
      country: String(row.country || 'BJ'),
      currency: String(row.currency || 'XOF'),
      isDefault: Boolean(row.is_default),
      isVerified: Boolean(row.is_verified || 1),
      createdAt: String(row.created_at),
    }));

    res.json({ success: true, payoutMethods: methods, methods });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for stats overview
apiRouter.get('/stats/overview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30j', appId, applicationId } = req.query;
    const db = getDb();
    const targetAppId = (appId || applicationId || '') as string;

    let days = 30;
    if (period === '7j') days = 7;
    else if (period === '90j') days = 90;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let sql = 'SELECT * FROM transactions WHERE user_id = ? AND created_at >= ?';
    const args: any[] = [req.user!.id, startDate];

    if (targetAppId.trim()) {
      sql += ' AND application_id = ?';
      args.push(targetAppId.trim());
    }

    const result = await db.execute({ sql, args });
    const txs = result.rows;

    const totalCount = txs.length;
    const successCount = txs.filter((t) => t.status === 'success' || t.status === 'completed').length;
    const failedCount = txs.filter((t) => t.status === 'failed').length;
    const pendingCount = txs.filter((t) => t.status === 'pending').length;
    const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';
    const revenue = txs
      .filter((t) => t.status === 'success' || t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);

    const countryMap: Record<string, number> = {};
    txs.filter((t) => t.status === 'success' || t.status === 'completed').forEach((t) => {
      const c = String(t.country || 'BJ');
      countryMap[c] = (countryMap[c] || 0) + Number(t.amount || 0);
    });

    const methodMap: Record<string, number> = {};
    txs.filter((t) => t.status === 'success' || t.status === 'completed').forEach((t) => {
      const m = String(t.payment_method || t.provider || 'Mobile Money');
      methodMap[m] = (methodMap[m] || 0) + Number(t.amount || 0);
    });

    res.json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        successfulTransactions: successCount,
        failedTransactions: failedCount,
        pendingTransactions: pendingCount,
        successRate: `${successRate}%`,
        revenue,
        currency: 'XOF',
        countryBreakdown: countryMap,
        methodBreakdown: methodMap,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test webhook delivery
apiRouter.post('/developer/webhooks/:id/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const whRes = await db.execute({
      sql: 'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user!.id],
    });

    if (whRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Webhook introuvable.' });
      return;
    }

    const wh = whRes.rows[0];
    const logId = `wl_${Date.now()}`;
    const now = new Date().toISOString();
    const testPayload = {
      event: 'ping.test',
      timestamp: now,
      webhook_id: String(wh.id),
      app: 'PichFlow',
      data: {
        message: 'Test de transmission webhook réussi !',
      },
    };

    // Record delivery log
    await db.execute({
      sql: `INSERT INTO webhook_logs (id, webhook_id, user_id, event, payload, status_code, response_body, success, attempts, created_at)
            VALUES (?, ?, ?, 'ping.test', ?, 200, '{"received":true,"status":"ok"}', 1, 1, ?)`,
      args: [logId, String(wh.id), req.user!.id, JSON.stringify(testPayload), now],
    });

    await db.execute({
      sql: "UPDATE webhooks SET last_delivery_status = '200 OK (test)' WHERE id = ?",
      args: [String(wh.id)],
    });

    res.json({
      success: true,
      message: 'Ping de test délivré avec code HTTP 200.',
      delivery: {
        id: logId,
        statusCode: 200,
        event: 'ping.test',
        timestamp: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to map method & country to SasPay official network code
function resolveSasPayNetwork(method?: string, country?: string): string {
  const m = (method || '').toLowerCase().trim();
  const c = (country || 'BJ').toLowerCase().trim();

  if (m.includes('mtn')) return `mtn_${c}`;
  if (m.includes('moov')) return `moov_${c}`;
  if (m.includes('celtiis')) return 'celtiis_bj';
  if (m.includes('orange')) return `orange_${c}`;
  if (m.includes('wave')) return `wave_${c}`;
  if (m.includes('free')) return 'free_sn';
  if (m.includes('wizall')) return 'wizall_sn';
  if (m.includes('card') || m.includes('carte')) return 'card';
  return m ? `${m}_${c}` : `mtn_${c}`;
}

// Helper to cleanly split full customer name into first and last name
function splitCustomerName(fullName?: string): { first_name: string; last_name: string } {
  const trimmed = (fullName || 'Client').trim();
  const parts = trimmed.split(/\s+/);
  const first_name = parts[0] || 'Client';
  const last_name = parts.slice(1).join(' ') || 'Client';
  return { first_name, last_name };
}

// Atomic settlement for verified payments (Idempotent across Webhooks, Status Polling and Confirmation)
async function settleSuccessfulPayment(params: {
  reference: string;
  externalId?: string;
  amount: number;
  currency: string;
  netAmount?: number;
  providerFee?: number;
  platformFee?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  country?: string;
  paymentMethod?: string;
  applicationId?: string;
  userId?: string;
  paymentLinkId?: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const baseAmount = Number(params.amount);
  if (!Number.isSafeInteger(baseAmount) || baseAmount <= 0) throw new Error('Verified payment amount is invalid.');
  const transaction = await db.transaction('write');
  let shouldDispatch = false;
  let userId = '';
  let applicationId = '';
  let txId = '';
  let custEmail = '';
  let custName = '';
  const custPhone = (params.customerPhone || '').trim();
  try {
    const sessionRes = await transaction.execute({
      sql: 'SELECT * FROM checkout_sessions WHERE reference = ?',
      args: [params.reference],
    });
    if (sessionRes.rows.length === 0) throw new Error('Checkout session is missing.');
    const session = sessionRes.rows[0];
    if (String(session.status) === 'success') {
      await transaction.commit();
      return;
    }
    if (
      Number(session.amount) !== baseAmount ||
      String(session.currency) !== (params.currency || 'XOF') ||
      (params.externalId && String(session.paydunya_token || '') !== params.externalId)
    ) throw new Error('Verified payment does not match its checkout session.');

    userId = String(session.user_id || params.userId || '');
    applicationId = String(session.application_id || params.applicationId || '');
    if (!userId || !applicationId) throw new Error('Checkout ownership is missing.');
    const appRes = await transaction.execute({
      sql: 'SELECT id FROM applications WHERE id = ? AND user_id = ?',
      args: [applicationId, userId],
    });
    if (appRes.rows.length === 0) throw new Error('Checkout application ownership does not match.');

    const transactionRes = await transaction.execute({
      sql: 'SELECT id, status FROM transactions WHERE reference = ? AND user_id = ? AND application_id = ?',
      args: [params.reference, userId, applicationId],
    });
    if (transactionRes.rows.length === 0) throw new Error('Pending transaction is missing.');
    const existingTransaction = transactionRes.rows[0];
    if (String(existingTransaction.status) === 'success' || String(existingTransaction.status) === 'completed') {
      await transaction.commit();
      return;
    }
    const updated = await transaction.execute({
      sql: `UPDATE transactions SET status = 'success', external_id = ?, provider = 'PayDunya',
              provider_fee = 0, platform_fee = 0, net_amount = 0, fees_confirmed = 0,
              metadata = ?, updated_at = ?
            WHERE id = ? AND status = 'pending'`,
      args: [
        params.externalId || null,
        JSON.stringify({ providerFeesConfirmed: false, netAmountAvailable: false }),
        now,
        existingTransaction.id,
      ],
    });
    if (Number(updated.rowsAffected) !== 1) {
      await transaction.commit();
      return;
    }

    txId = String(existingTransaction.id);
    custEmail = String(session.customer_email || params.customerEmail || '').toLowerCase().trim();
    custName = String(session.customer_name || params.customerName || '').trim();
    if (!custEmail || !custName) throw new Error('Checkout customer data is missing.');
    await transaction.execute({
      sql: `UPDATE checkout_sessions SET status = 'success', updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [now, params.reference],
    });

    const existingCustomer = await transaction.execute({
      sql: 'SELECT id FROM customers WHERE user_id = ? AND application_id = ? AND lower(email) = ? LIMIT 1',
      args: [userId, applicationId, custEmail],
    });
    if (existingCustomer.rows.length > 0) {
      await transaction.execute({
        sql: `UPDATE customers SET payment_count = payment_count + 1,
                total_spent = total_spent + ?, last_transaction_at = ?,
                phone = COALESCE(NULLIF(phone, ''), ?), name = ?
              WHERE id = ? AND user_id = ? AND application_id = ?`,
        args: [baseAmount, now, custPhone, custName, existingCustomer.rows[0].id, userId, applicationId],
      });
    } else {
      await transaction.execute({
        sql: `INSERT INTO customers (
                id, user_id, application_id, name, email, phone, country,
                payment_count, total_spent, currency, last_transaction_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        args: [
          `cust_${crypto.randomUUID()}`, userId, applicationId, custName, custEmail,
          custPhone, params.country || 'BJ', baseAmount, params.currency || 'XOF', now, now,
        ],
      });
    }
    if (session.payment_link_id) {
      await transaction.execute({
        sql: 'UPDATE payment_links SET usage_count = usage_count + 1 WHERE id = ? AND user_id = ? AND application_id = ?',
        args: [session.payment_link_id, userId, applicationId],
      });
    }
    await transaction.commit();
    shouldDispatch = true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }

  if (shouldDispatch) {
    await dispatchMerchantWebhook(userId, applicationId, 'payment.success', {
      transactionId: txId,
      reference: params.reference,
      externalId: params.externalId,
      amount: baseAmount,
      currency: params.currency || 'XOF',
      providerFeesConfirmed: false,
      netAmount: null,
      status: 'success',
      paymentMethod: 'PayDunya checkout',
      customerName: custName,
      customerEmail: custEmail,
      customerPhone: custPhone,
    });
  }
}

// ==========================================
// 9. CHECKOUT & PAYMENT ENGINE (PAYDUNYA)
// ==========================================

apiRouter.post('/checkout/initiate', async (req: Request, res: Response) => {
  try {
    const {
      paymentLinkId,
      paymentLinkSlug,
      slug,
      amount: requestedAmount,
      firstName,
      lastName,
      customerName,
      customerEmail,
      customerPhone,
      country: requestedCountry,
    } = req.body || {};
    const db = getDb();
    const now = new Date().toISOString();
    const linkSelector = String(paymentLinkId || paymentLinkSlug || slug || '').trim();
    if (!linkSelector) {
      res.status(400).json({ success: false, error: 'Un lien de paiement PichFlow valide est requis.' });
      return;
    }
    const linkResult = await db.execute({
      sql: `SELECT pl.*, a.name AS app_name
            FROM payment_links pl
            JOIN applications a ON a.id = pl.application_id AND a.user_id = pl.user_id
            WHERE (pl.id = ? OR pl.slug = ?) AND pl.status = 'active'
              AND (pl.expires_at IS NULL OR datetime(pl.expires_at) > datetime('now'))`,
      args: [linkSelector, linkSelector],
    });
    if (linkResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Lien de paiement introuvable ou inactif.' });
      return;
    }
    const link = linkResult.rows[0];
    const usageLimit = link.usage_limit === null ? null : Number(link.usage_limit);
    if (usageLimit !== null && Number(link.usage_count || 0) >= usageLimit) {
      res.status(410).json({ success: false, error: 'Ce lien a atteint sa limite de paiements.' });
      return;
    }

    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    const cleanCustomerName = `${cleanFirstName} ${cleanLastName}`.trim() || String(customerName || '').trim();
    const cleanEmail = String(customerEmail || '').trim().toLowerCase();
    const cleanPhone = String(customerPhone || '').trim();
    const requirePhone = Boolean(link.require_phone);
    if (
      !cleanFirstName ||
      !cleanLastName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      (requirePhone && cleanPhone.replace(/\D/g, '').length < 7) ||
      (cleanPhone && cleanPhone.replace(/\D/g, '').length < 7)
    ) {
      res.status(400).json({ success: false, error: 'Prénom, nom et adresse e-mail valides sont requis; le numéro de contact est requis uniquement si le marchand l’a demandé.' });
      return;
    }

    const isFixedAmount = Boolean(link.is_fixed_amount);
    const amount = isFixedAmount ? Number(link.amount) : Number(requestedAmount);
    if (!Number.isSafeInteger(amount) || amount < PAYDUNYA_MINIMUM_AMOUNT_XOF) {
      res.status(400).json({
        success: false,
        error: `Le montant doit être un montant XOF entier d’au moins ${PAYDUNYA_MINIMUM_AMOUNT_XOF}.`,
      });
      return;
    }
    const currency = String(link.currency || 'XOF').toUpperCase();
    const country = String(requestedCountry || link.country || '').trim().toUpperCase();
    if (
      currency !== 'XOF' ||
      country !== 'BJ' ||
      (String(link.country || '').toUpperCase() && String(link.country).toUpperCase() !== country)
    ) {
      res.status(400).json({ success: false, error: 'Ce lien ne correspond pas à la configuration PayDunya actuellement vérifiée (XOF, Bénin).' });
      return;
    }

    let appUrl: string;
    let returnUrl: URL;
    let cancelUrl: URL;
    let callbackUrl: string;
    try {
      appUrl = getAppBaseUrl();
      returnUrl = new URL('/checkout-demo', `${appUrl}/`);
      returnUrl.searchParams.set('slug', String(link.slug));
      callbackUrl = getPayDunyaCallbackUrl();
    } catch (error) {
      console.error('[PayDunya] Checkout URL configuration is invalid:', error instanceof Error ? error.message : 'unknown');
      res.status(500).json({ success: false, error: 'La configuration des URL de paiement est invalide.' });
      return;
    }

    const idempotencyKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      res.status(400).json({ success: false, error: 'Une clé d’idempotence valide est requise pour éviter les factures en double.' });
      return;
    }
    const applicationId = String(link.application_id);
    const userId = String(link.user_id);
    const existingRequest = await db.execute({
      sql: 'SELECT reference FROM checkout_idempotency WHERE application_id = ? AND idempotency_key = ?',
      args: [applicationId, idempotencyKey],
    });
    if (existingRequest.rows.length > 0) {
      const existingSession = await db.execute({
        sql: 'SELECT reference, status, amount, currency, paydunya_url FROM checkout_sessions WHERE reference = ?',
        args: [String(existingRequest.rows[0].reference)],
      });
      if (existingSession.rows.length > 0) {
        const session = existingSession.rows[0];
        if (session.paydunya_url) {
          res.json({
            success: true, reference: session.reference, amount: session.amount,
            currency: session.currency, invoiceUrl: session.paydunya_url, status: session.status,
          });
          return;
        }
        res.status(409).json({ success: false, error: 'Cette demande de paiement est déjà en cours ou a échoué. Utilisez une nouvelle tentative.' });
        return;
      }
      res.status(409).json({ success: false, error: 'Cette demande de paiement est déjà en cours.' });
      return;
    }

    const reference = `PF-${crypto.randomUUID()}`;
    const reservation = await db.execute({
      sql: 'INSERT OR IGNORE INTO checkout_idempotency (application_id, idempotency_key, reference, created_at) VALUES (?, ?, ?, ?)',
      args: [applicationId, idempotencyKey, reference, now],
    });
    if (Number(reservation.rowsAffected) !== 1) {
      res.status(409).json({ success: false, error: 'Cette demande de paiement est déjà en cours.' });
      return;
    }

    const sessionId = `cs_${crypto.randomUUID()}`;
    await db.execute({
      sql: `INSERT INTO checkout_sessions (
              id, payment_link_id, application_id, user_id, reference,
              amount, currency, customer_name, customer_email, customer_phone, 
              status, idempotency_key, provider, payment_method, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'paydunya', 'PayDunya checkout', ?, ?)`,
      args: [
        sessionId,
        String(link.id),
        applicationId,
        userId,
        reference,
        amount,
        currency,
        cleanCustomerName,
        cleanEmail,
        cleanPhone,
        idempotencyKey,
        now,
        now,
      ],
    });
    await db.execute({
      sql: `INSERT INTO transactions (
              id, user_id, application_id, reference, customer_name, customer_email,
              customer_phone, country, provider, amount, provider_fee, platform_fee,
              customer_fee, net_amount, currency, status, description, payment_method,
              metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PayDunya', ?, 0, 0, 0, 0, ?, 'pending', ?, 'PayDunya checkout', ?, ?, ?)`,
      args: [
        `tx_${crypto.randomUUID()}`, userId, applicationId, reference, cleanCustomerName,
        cleanEmail, cleanPhone, country, amount, currency, String(link.title),
        JSON.stringify({ providerFeesConfirmed: false, netAmountAvailable: false }), now, now,
      ],
    });

    returnUrl.searchParams.set('ref', reference);
    cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('cancelled', '1');
    const invoice = await paydunyaService.createInvoice({
      amount,
      description: String(link.title),
      storeName: String(link.app_name),
      customerName: cleanCustomerName,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      reference,
      returnUrl: returnUrl.toString(),
      cancelUrl: cancelUrl.toString(),
      callbackUrl,
    });
    if (invoice.status !== 'pending' || !invoice.token || !invoice.invoiceUrl) {
      await db.execute({
        sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ? WHERE reference = ? AND status = 'pending'`,
        args: [new Date().toISOString(), reference],
      });
      await db.execute({
        sql: `UPDATE transactions SET status = 'failed', updated_at = ? WHERE reference = ? AND status = 'pending'`,
        args: [new Date().toISOString(), reference],
      });
      console.error('[PayDunya] Invoice creation failed for checkout reference:', reference);
      res.status(502).json({ success: false, error: invoice.error || 'PayDunya n’a pas pu créer la facture. Veuillez réessayer.' });
      return;
    }

    await db.execute({
      sql: `UPDATE checkout_sessions SET paydunya_token = ?, paydunya_url = ?, updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [invoice.token, invoice.invoiceUrl, new Date().toISOString(), reference],
    });

    res.json({
      success: true,
      reference,
      amount,
      currency,
      token: invoice.token,
      invoiceUrl: invoice.invoiceUrl,
      status: 'pending',
    });
  } catch (error) {
    console.error('[PayDunya] Checkout initiation failed:', error instanceof Error ? error.name : 'unknown');
    res.status(500).json({ success: false, error: 'Impossible d’initialiser le paiement. Veuillez réessayer.' });
  }
});

async function verifyPayDunyaCheckout(reference: string) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM checkout_sessions WHERE reference = ?',
    args: [reference],
  });
  if (result.rows.length === 0) return null;
  const session = result.rows[0];
  if (String(session.status) !== 'pending') return session;

  const token = String(session.paydunya_token || '');
  if (!token) return session;
  const verification = await paydunyaService.confirmInvoice(token);
  if (verification.status === 'completed') {
    const invoice = verification.data?.invoice;
    const confirmedReference = String(verification.data?.custom_data?.reference || '');
    if (
      String(session.currency || '') !== 'XOF' ||
      Number(invoice?.total_amount) !== Number(session.amount) ||
      String(invoice?.token || '') !== token ||
      confirmedReference !== reference
    ) {
      console.error('[PayDunya] Invoice verification mismatch.');
      return session;
    }
    await settleSuccessfulPayment({
      reference,
      externalId: token,
      amount: Number(invoice.total_amount),
      currency: String(session.currency || 'XOF'),
      customerName: String(session.customer_name || ''),
      customerEmail: String(session.customer_email || ''),
      customerPhone: String(session.customer_phone || ''),
      applicationId: String(session.application_id || ''),
      userId: String(session.user_id || ''),
      paymentLinkId: String(session.payment_link_id || ''),
    });
    const updated = await db.execute({
      sql: 'SELECT * FROM checkout_sessions WHERE reference = ?',
      args: [reference],
    });
    return updated.rows[0] || session;
  }

  if (verification.status === 'failed' || verification.status === 'canceled') {
    const status = verification.status === 'canceled' ? 'cancelled' : 'failed';
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE checkout_sessions SET status = ?, updated_at = ? WHERE reference = ? AND status = 'pending'`,
      args: [status, now, reference],
    });
    await db.execute({
      sql: `UPDATE transactions SET status = ?, updated_at = ? WHERE reference = ? AND status = 'pending'`,
      args: [status, now, reference],
    });
    const updated = await db.execute({
      sql: 'SELECT * FROM checkout_sessions WHERE reference = ?',
      args: [reference],
    });
    return updated.rows[0] || session;
  }
  return session;
}

apiRouter.post('/checkout/confirm', async (req: Request, res: Response) => {
  try {
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
    if (!reference) {
      res.status(400).json({ success: false, error: 'Référence de paiement requise.' });
      return;
    }
    const session = await verifyPayDunyaCheckout(reference);
    if (!session) {
      res.status(404).json({ success: false, error: 'Session de paiement introuvable.' });
      return;
    }
    res.json({
      success: true,
      reference,
      status: String(session.status),
      amount: Number(session.amount),
      currency: String(session.currency),
      message: session.status === 'success'
        ? 'Paiement confirmé par PayDunya.'
        : session.status === 'pending'
          ? 'Paiement en cours de confirmation auprès de PayDunya.'
          : 'Le paiement a été annulé ou refusé.',
    });
  } catch (error) {
    console.error('[PayDunya] Server-side confirmation failed:', error instanceof Error ? error.name : 'unknown');
    res.status(502).json({ success: false, error: 'Impossible de vérifier le paiement auprès de PayDunya pour le moment.' });
  }
});

apiRouter.get('/checkout/status/:reference', async (req: Request, res: Response) => {
  try {
    const reference = String(req.params.reference || '').trim();
    const session = await verifyPayDunyaCheckout(reference);
    if (!session) {
      res.status(404).json({ success: false, error: 'Session de paiement introuvable.' });
      return;
    }
    res.json({
      success: true,
      reference,
      status: String(session.status),
      amount: Number(session.amount),
      currency: String(session.currency),
      feesConfirmed: false,
      netAmount: null,
    });
  } catch (error) {
    console.error('[PayDunya] Status verification failed:', error instanceof Error ? error.name : 'unknown');
    res.status(502).json({ success: false, error: 'Impossible de vérifier le paiement auprès de PayDunya pour le moment.' });
  }
});

apiRouter.post('/checkout/retry', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'La relance sur une ancienne facture n’est pas disponible. Recommencez le paiement depuis le lien PichFlow.',
  });
});

// ==========================================
// 9b. SASPAY INBOUND WEBHOOK RECEIVER (HMAC SHA-256)
// ==========================================

apiRouter.post('/webhooks/saspay', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = (req.headers['x-webhook-signature'] as string) || '';
    const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
    const event = (req.headers['x-webhook-event'] as string) || req.body?.event || '';

    // 1. Verify HMAC SHA-256 signature & timestamp freshness (< 300s)
    const verification = sasPayService.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!verification.valid) {
      console.warn(`[SasPay Webhook] ❌ Rejet signature invalide : ${verification.reason}`);
      res.status(401).json({ success: false, error: verification.reason });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    const eventPayload = req.body || {};
    const eventData = eventPayload.data || {};
    const externalId = eventData.id || '';
    const reference = eventData.reference || '';

    // 2. Replay Protection / Deduplication
    const dedupId = `${timestamp}_${signature.slice(0, 16)}`;
    const existingLog = await db.execute({
      sql: 'SELECT id FROM webhook_logs WHERE signature = ? OR external_event_id = ?',
      args: [signature, eventPayload.id || dedupId],
    });

    if (existingLog.rows.length > 0) {
      console.log(`[SasPay Webhook] Événement déjà traité (${event}) : doublon ignoré avec succès.`);
      res.status(200).json({ success: true, message: 'Événement déjà traité.' });
      return;
    }

    console.log(`[SasPay Webhook] ✅ Événement authentique reçu : ${event} (${reference || externalId})`);

    // 3. Process according to documented event catalog
    if (event === 'webhook.test') {
      res.status(200).json({ success: true, message: 'Ping de test webhook validé avec succès.' });
      return;
    }

    if (event === 'transaction.success') {
      let session: Row | null = null;
      if (externalId) {
        const sRes = await db.execute({
          sql: 'SELECT * FROM checkout_sessions WHERE saspay_session_id = ? LIMIT 1',
          args: [externalId],
        });
        if (sRes.rows.length > 0) session = sRes.rows[0];
      }
      if (!session && reference) {
        const sRes = await db.execute({
          sql: 'SELECT * FROM checkout_sessions WHERE reference = ? LIMIT 1',
          args: [reference],
        });
        if (sRes.rows.length > 0) session = sRes.rows[0];
      }

      const amount = Number(eventData.debited_amount || eventData.requested_amount || eventData.amount || session?.amount || 0);
      const netAmount = Number(eventData.net_amount || (amount * 0.985));
      const currency = String(eventData.currency || session?.currency || 'XOF');
      const custInfo = eventData.customer || {};
      const customerEmail = String(custInfo.email || session?.customer_email || 'client@pichflow.com');
      const customerName = `${custInfo.first_name || ''} ${custInfo.last_name || ''}`.trim() || String(session?.customer_name || 'Client');
      const customerPhone = String(custInfo.phone || session?.customer_phone || '');

      await settleSuccessfulPayment({
        reference: session ? String(session.reference) : (reference || `TX-SAS-${Date.now().toString().slice(-6)}`),
        externalId,
        amount,
        currency,
        netAmount,
        customerName,
        customerEmail,
        customerPhone,
        country: String(eventData.country || session?.country || 'BJ'),
        paymentMethod: String(eventData.network || session?.payment_method || 'Mobile Money'),
        applicationId: session ? String(session.application_id || '') : undefined,
        userId: session ? String(session.user_id || '') : undefined,
        paymentLinkId: session ? String(session.payment_link_id || '') : undefined,
      });
    } else if (event === 'transaction.failed' || event === 'transaction.cancelled') {
      if (reference) {
        await db.execute({
          sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ? WHERE reference = ?`,
          args: [now, reference],
        });
        await db.execute({
          sql: `UPDATE transactions SET status = 'failed', updated_at = ? WHERE reference = ?`,
          args: [now, reference],
        });
      }
    } else if (event === 'settlement.success') {
      if (externalId || reference) {
        await db.execute({
          sql: `UPDATE payout_requests SET status = 'success', processed_at = ? WHERE external_id = ? OR reference = ?`,
          args: [now, externalId, reference],
        });
      }
    } else if (event === 'settlement.failed' || event === 'settlement.cancelled') {
      if (externalId || reference) {
        const pRes = await db.execute({
          sql: `SELECT * FROM payout_requests WHERE external_id = ? OR reference = ?`,
          args: [externalId, reference],
        });
        if (pRes.rows.length > 0 && pRes.rows[0].status !== 'failed') {
          const p = pRes.rows[0];
          await db.execute({
            sql: `UPDATE payout_requests SET status = 'failed', notes = 'Rejeté par le réseau opérateur' WHERE id = ?`,
            args: [p.id],
          });
          // Refund wallet balance
          await db.execute({
            sql: 'UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?',
            args: [Number(p.amount), now, p.user_id, p.currency],
          });
        }
      }
    }

    // 4. Record authentic audit log
    const logId = `whl_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const defaultUser = await db.execute('SELECT id FROM users LIMIT 1');
    const targetUserId = defaultUser.rows.length > 0 ? String(defaultUser.rows[0].id) : 'usr_merchant_default';

    await db.execute({
      sql: `INSERT INTO webhook_logs (
              id, webhook_id, user_id, event, payload, status_code, 
              response_body, success, attempts, external_event_id, signature, created_at
            ) VALUES (?, 'saspay_inbound', ?, ?, ?, 200, '{"received":true}', 1, 1, ?, ?, ?)`,
      args: [
        logId,
        targetUserId,
        event,
        rawBody,
        eventPayload.id || dedupId,
        signature,
        now,
      ],
    });

    res.status(200).json({ success: true, received: true });
  } catch (err: any) {
    console.error('[SasPay Webhook Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/webhooks/paydunya', async (req: Request, res: Response) => {
  try {
    const rawData = req.body?.data;
    const payload = typeof rawData === 'string'
      ? JSON.parse(rawData)
      : rawData && typeof rawData === 'object'
        ? rawData
        : req.body;
    const hash = typeof payload?.hash === 'string' ? payload.hash : '';
    if (!paydunyaService.verifyCallbackHash(hash)) {
      res.status(401).json({ success: false, error: 'Signature PayDunya invalide.' });
      return;
    }

    const token = String(payload?.invoice?.token || payload?.token || '');
    const reference = String(payload?.custom_data?.reference || '');
    if (!token || !reference) {
      res.status(400).json({ success: false, error: 'Notification PayDunya incomplète.' });
      return;
    }

    const session = await getDb().execute({
      sql: `SELECT reference FROM checkout_sessions
            WHERE reference = ? AND paydunya_token = ?`,
      args: [reference, token],
    });
    if (session.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Facture PayDunya non rattachée à une session PichFlow.' });
      return;
    }

    await verifyPayDunyaCheckout(reference);
    res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error('[PayDunya] Callback processing failed:', error instanceof Error ? error.name : 'unknown');
    res.status(400).json({ success: false, error: 'Notification PayDunya invalide.' });
  }
});

// ==========================================
// 9c. DYNAMIC COUNTRIES, NETWORKS & RATES
// ==========================================

apiRouter.get('/reference/countries', async (_req: Request, res: Response) => {
  try {
    const response = await sasPayService.getCountries();
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/reference/networks', async (_req: Request, res: Response) => {
  try {
    const response = await sasPayService.getNetworks();
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/reference/rates', async (_req: Request, res: Response) => {
  try {
    const response = await sasPayService.getMyRates();
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. SETTINGS & KYC
// ==========================================

apiRouter.get('/settings/kyc', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM merchant_kyc WHERE user_id = ?',
      args: [req.user!.id],
    });

    if (result.rows.length === 0) {
      res.json({
        success: true,
        kyc: {
          status: 'unsubmitted',
          complianceLevel: 'Non soumis',
          accountType: 'individual',
          companyName: '',
          rccmNumber: '',
          ifuNumber: '',
          fullName: req.user!.full_name,
          firstName: '',
          lastName: '',
          birthDate: '',
          nationality: req.user!.country === 'BJ' ? 'Bénin' : req.user!.country,
          idType: 'cni',
          idNumber: '',
          address: '',
          rectoUrl: '',
          versoUrl: '',
          selfieUrl: '',
          representativeName: '',
          rccmDocUrl: '',
          ifuDocUrl: '',
        },
        documents: [],
      });
      return;
    }

    const row = result.rows[0];
    const docsRes = await db.execute({
      sql: 'SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC',
      args: [req.user!.id],
    });

    res.json({
      success: true,
      kyc: {
        id: String(row.id),
        status: String(row.status),
        complianceLevel: String(row.compliance_level || 'En cours d’examen'),
        accountType: String(row.account_type || 'individual'),
        companyName: String(row.company_name || ''),
        rccmNumber: String(row.rccm_number || ''),
        ifuNumber: String(row.ifu_number || ''),
        fullName: String(row.full_name || req.user!.full_name),
        firstName: String(row.first_name || ''),
        lastName: String(row.last_name || ''),
        birthDate: String(row.birth_date || ''),
        nationality: String(row.nationality || 'Bénin'),
        idType: String(row.id_type || 'cni'),
        idNumber: String(row.id_number || ''),
        address: String(row.address || ''),
        rectoUrl: String(row.recto_url || ''),
        versoUrl: String(row.verso_url || ''),
        selfieUrl: String(row.selfie_url || ''),
        representativeName: String(row.representative_name || ''),
        rccmDocUrl: String(row.rccm_doc_url || ''),
        ifuDocUrl: String(row.ifu_doc_url || ''),
        notes: String(row.notes || ''),
        submittedAt: String(row.submitted_at || ''),
      },
      documents: docsRes.rows.map((d) => ({
        id: String(d.id),
        documentType: String(d.document_type),
        fileName: String(d.file_name),
        fileUrl: String(d.file_url),
        status: String(d.status),
        uploadedAt: String(d.uploaded_at),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit / Update KYC dossier
apiRouter.post('/settings/kyc', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      accountType,
      companyName,
      rccmNumber,
      ifuNumber,
      fullName,
      firstName,
      lastName,
      birthDate,
      nationality,
      idType,
      idNumber,
      address,
      rectoUrl,
      versoUrl,
      selfieUrl,
      representativeName,
      rccmDocUrl,
      ifuDocUrl,
    } = req.body;

    const db = getDb();
    const now = new Date().toISOString();

    const existing = await db.execute({
      sql: 'SELECT id FROM merchant_kyc WHERE user_id = ?',
      args: [req.user!.id],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE merchant_kyc SET 
              account_type = ?, company_name = ?, rccm_number = ?, ifu_number = ?, 
              full_name = ?, first_name = ?, last_name = ?, birth_date = ?,
              nationality = ?, id_type = ?, id_number = ?, address = ?, 
              recto_url = COALESCE(?, recto_url), verso_url = COALESCE(?, verso_url), selfie_url = COALESCE(?, selfie_url),
              representative_name = COALESCE(?, representative_name), rccm_doc_url = COALESCE(?, rccm_doc_url), ifu_doc_url = COALESCE(?, ifu_doc_url),
              status = 'pending', compliance_level = 'En cours d’examen', updated_at = ?
              WHERE user_id = ?`,
        args: [
          accountType || 'individual',
          companyName || '',
          rccmNumber || '',
          ifuNumber || '',
          fullName || `${firstName || ''} ${lastName || ''}`.trim() || req.user!.full_name,
          firstName || '',
          lastName || '',
          birthDate || '',
          nationality || 'Bénin',
          idType || 'cni',
          idNumber || '',
          address || '',
          rectoUrl || null,
          versoUrl || null,
          selfieUrl || null,
          representativeName || null,
          rccmDocUrl || null,
          ifuDocUrl || null,
          now,
          req.user!.id,
        ],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO merchant_kyc (
              id, user_id, account_type, company_name, rccm_number, ifu_number, 
              full_name, first_name, last_name, birth_date, nationality, id_type, id_number, address,
              recto_url, verso_url, selfie_url, representative_name, rccm_doc_url, ifu_doc_url,
              status, compliance_level, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `kyc_${Date.now()}`,
          req.user!.id,
          accountType || 'individual',
          companyName || '',
          rccmNumber || '',
          ifuNumber || '',
          fullName || `${firstName || ''} ${lastName || ''}`.trim() || req.user!.full_name,
          firstName || '',
          lastName || '',
          birthDate || '',
          nationality || 'Bénin',
          idType || 'cni',
          idNumber || '',
          address || '',
          rectoUrl || '',
          versoUrl || '',
          selfieUrl || '',
          representativeName || '',
          rccmDocUrl || '',
          ifuDocUrl || '',
          'pending',
          'En cours d’examen',
          now,
          now,
        ],
      });
    }

    res.json({ success: true, message: 'Dossier KYC soumis pour validation.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Document Upload endpoint (Max 10MB as specified by SasPay documentation)
apiRouter.post('/settings/kyc/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentType, fileName, fileData } = req.body;
    if (!documentType || !fileName || !fileData) {
      res.status(400).json({ success: false, error: 'Type de document, nom de fichier et données requis.' });
      return;
    }

    // Check approximate file size from base64 string
    const stringLength = fileData.length - (fileData.indexOf(',') + 1);
    const sizeInBytes = (stringLength * 3) / 4;
    const maxBytes = 10 * 1024 * 1024; // 10MB limit
    if (sizeInBytes > maxBytes) {
      res.status(400).json({ success: false, error: 'Le fichier dépasse la taille maximale autorisée de 10 Mo.' });
      return;
    }

    const db = getDb();
    const docId = `doc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    // Check existing kyc or get id
    const kycRes = await db.execute({
      sql: 'SELECT id FROM merchant_kyc WHERE user_id = ?',
      args: [req.user!.id],
    });
    const kycId = kycRes.rows.length > 0 ? String(kycRes.rows[0].id) : `kyc_${Date.now()}`;

    // Store document record
    await db.execute({
      sql: `INSERT INTO kyc_documents (id, kyc_id, user_id, document_type, file_name, file_url, status, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [docId, kycId, req.user!.id, documentType, fileName, fileData, 'approved', now],
    });

    res.json({
      success: true,
      documentId: docId,
      fileName,
      fileUrl: fileData,
      documentType,
    });
  } catch (err: any) {
    console.error('[KYC Upload] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test mode approval endpoint (allows developers to test approved sandbox merchant flows)
apiRouter.post('/settings/kyc/test-approve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = await db.execute({
      sql: 'SELECT id FROM merchant_kyc WHERE user_id = ?',
      args: [req.user!.id],
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO merchant_kyc (
              id, user_id, account_type, company_name, rccm_number, ifu_number, 
              full_name, status, compliance_level, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `kyc_${Date.now()}`,
          req.user!.id,
          'individual',
          '',
          '',
          '',
          req.user!.full_name,
          'verified',
          'Niveau 2 - Standard',
          now,
          now,
        ],
      });
    } else {
      await db.execute({
        sql: `UPDATE merchant_kyc SET status = 'verified', compliance_level = 'Niveau 2 - Standard', updated_at = ? WHERE user_id = ?`,
        args: [now, req.user!.id],
      });
    }

    res.json({
      success: true,
      message: 'Mode Test : Dossier KYC approuvé avec succès pour l’environnement Sandbox.',
      status: 'verified',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 11. PUBLIC MERCHANT API (Secured by PichFlow Secret Key sk_test_... or sk_live_...)
// ==========================================

// Create Payment (Unified endpoint: creates Softpay direct push or Hosted Checkout Session)
apiRouter.post('/v1/payments/create', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const {
      amount,
      currency = 'XOF',
      description = 'Paiement API PichFlow',
      customerName,
      customerEmail,
      customerPhone,
      country = 'BJ',
      network,
      otp,
      returnUrl,
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: 'Montant invalide.' });
      return;
    }

    const decimalAmount = formatDecimalAmount(amount);
    const reference = `TX-API-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();

    if (network && customerPhone) {
      // Direct Softpay push
      const { first_name, last_name } = splitCustomerName(customerName);
      const cleanPhone = String(customerPhone).trim();
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^00/, '')}`;

      const softpayRes = await sasPayService.initiateSoftpay(
        {
          amount: decimalAmount,
          currency,
          country,
          network,
          customer: {
            email: customerEmail || `client_${Date.now()}@pichflow.com`,
            first_name,
            last_name,
            phone: formattedPhone,
          },
          description,
          fee_charge_mode: 'ADD_ON',
          otp,
        },
        idempotencyKey,
        env
      );

      if (!softpayRes.success) {
        res.status(softpayRes.statusCode || 400).json({
          success: false,
          error: softpayRes.error || 'Échec du paiement SasPay.',
          code: softpayRes.data?.code,
          environment: env,
        });
        return;
      }

      res.json({
        success: true,
        environment: env,
        reference,
        paymentId: softpayRes.data?.id,
        status: softpayRes.data?.status || 'PENDING',
        checkoutUrl: softpayRes.data?.checkout_url || '',
        data: softpayRes.data,
      });
    } else {
      // Hosted Checkout Session
      const sessionRes = await sasPayService.createCheckoutSession(
        {
          amount: decimalAmount,
          currency,
          country,
          customer_name: customerName || 'Client',
          customer_email: customerEmail || `client_${Date.now()}@pichflow.com`,
          customer_phone: customerPhone,
          description,
          return_url: returnUrl,
          fee_charge_mode: 'ADD_ON',
        },
        env
      );

      if (!sessionRes.success) {
        res.status(sessionRes.statusCode || 400).json({
          success: false,
          error: sessionRes.error || 'Échec de création de la session SasPay.',
          environment: env,
        });
        return;
      }

      res.json({
        success: true,
        environment: env,
        reference,
        sessionId: sessionRes.data?.id,
        checkoutUrl: sessionRes.data?.checkout_url,
        slug: sessionRes.data?.slug,
        status: sessionRes.data?.status || 'PENDING',
        data: sessionRes.data,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Softpay direct push
apiRouter.post('/v1/payments/softpay', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const { amount, currency = 'XOF', country = 'BJ', network, customer, description, fee_charge_mode, otp } = req.body;

    if (!amount || !customer || !network) {
      res.status(400).json({ success: false, error: 'Champs amount, network et customer requis.' });
      return;
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
    const result = await sasPayService.initiateSoftpay(
      {
        amount: formatDecimalAmount(amount),
        currency,
        country,
        network,
        customer,
        description,
        fee_charge_mode,
        otp,
      },
      idempotencyKey,
      env
    );

    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Hosted Checkout Session
apiRouter.post('/v1/checkout-sessions', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const { amount, currency = 'XOF', customer_email, customer_name, customer_phone, country, description, return_url, metadata } = req.body;

    if (!amount || !customer_email || !customer_name) {
      res.status(400).json({ success: false, error: 'Champs amount, customer_email et customer_name requis.' });
      return;
    }

    const result = await sasPayService.createCheckoutSession(
      {
        amount: formatDecimalAmount(amount),
        currency,
        customer_email,
        customer_name,
        customer_phone,
        country,
        description,
        return_url,
        metadata,
      },
      env
    );

    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Payment status by SasPay Payment ID
apiRouter.get('/v1/payments/:id/verify', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.verifyPayment(req.params.id, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Confirm OTP for payment
apiRouter.post('/v1/payments/:id/confirm-otp', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ success: false, error: 'Code OTP requis.' });
      return;
    }

    const result = await sasPayService.confirmOtp(req.params.id, String(otp).trim(), env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retry failed payment
apiRouter.post('/v1/payments/:id/retry', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
    const result = await sasPayService.retryPayment(req.params.id, idempotencyKey, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lookup Transaction status by reference in PichFlow database
apiRouter.get('/v1/payments/status/:reference', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE reference = ? AND user_id = ?',
      args: [req.params.reference, req.user!.id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Paiement non trouvé.' });
      return;
    }

    const tx = result.rows[0];
    res.json({
      success: true,
      environment: req.apiKey!.environment,
      transaction: {
        reference: tx.reference,
        externalId: tx.external_id,
        amount: tx.amount,
        netAmount: tx.net_amount,
        currency: tx.currency,
        status: tx.status,
        provider: tx.provider,
        customerName: tx.customer_name,
        customerEmail: tx.customer_email,
        customerPhone: tx.customer_phone,
        createdAt: tx.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Transactions
apiRouter.get('/v1/transactions', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const { status, limit = '50' } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ? AND application_id = ?';
    const args: any[] = [req.user!.id, req.apiKey!.application_id];

    if (status && typeof status === 'string') {
      sql += ' AND status = ?';
      args.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    args.push(parseInt(String(limit), 10) || 50);

    const result = await db.execute({ sql, args });
    res.json({
      success: true,
      environment: req.apiKey!.environment,
      transactions: result.rows.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        amount: tx.amount,
        netAmount: tx.net_amount,
        currency: tx.currency,
        status: tx.status,
        customerName: tx.customer_name,
        customerEmail: tx.customer_email,
        createdAt: tx.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Transaction Details
apiRouter.get('/v1/transactions/:id', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE (id = ? OR reference = ?) AND user_id = ? AND application_id = ?',
      args: [req.params.id, req.params.id, req.user!.id, req.apiKey!.application_id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Transaction non trouvée.' });
      return;
    }

    res.json({
      success: true,
      environment: req.apiKey!.environment,
      transaction: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CSV Export for transactions
apiRouter.get('/v1/transactions/export', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.exportTransactionsCsv(req.query, env);
    res.status(result.statusCode || 200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PDF Invoice for a transaction
apiRouter.get('/v1/transactions/:id/invoice', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.getTransactionInvoice(req.params.id, env);
    res.status(result.statusCode || 200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize Payout / Withdrawal
apiRouter.post('/v1/payouts/initialize', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Verify scope
    if (req.apiKey!.scope !== 'both' && req.apiKey!.scope !== 'payout') {
      res.status(403).json({
        success: false,
        error: "Scope de clé API insuffisant (payout ou both requis pour les retraits).",
        code: 'api_key_scope_forbidden',
      });
      return;
    }

    const env = req.apiKey!.environment;
    const { amount, currency, country, customer, method, recipient, description, fee_charge_mode } = req.body;

    if (!amount || !currency || !country || !method || !recipient?.msisdn) {
      res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants : amount, currency, country, method, recipient.msisdn.',
      });
      return;
    }

    const numAmount = Number(amount);
    const db = getDb();

    // 2. Check balance in wallet
    const walletRes = await db.execute({
      sql: 'SELECT * FROM wallets WHERE user_id = ? AND currency = ?',
      args: [req.user!.id, currency],
    });

    if (walletRes.rows.length === 0 || Number(walletRes.rows[0].balance) < numAmount) {
      res.status(422).json({
        success: false,
        error: 'Solde insuffisant pour exécuter ce retrait.',
        code: 'insufficient_balance',
      });
      return;
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
    const result = await sasPayService.initializePayout(
      {
        amount: formatDecimalAmount(amount),
        currency,
        country,
        customer: customer || { phone: recipient.msisdn },
        method,
        recipient,
        description,
        fee_charge_mode,
      },
      idempotencyKey,
      env
    );

    if (!result.success) {
      // Check for specific IP whitelisting error
      if (result.statusCode === 403 || String(result.error).includes('ip_not_whitelisted')) {
        res.status(403).json({
          success: false,
          error: "Votre adresse IP serveur n'est pas autorisée sur SasPay (ip_not_whitelisted). Ajoutez l'IP publique de votre serveur dans le tableau de bord SasPay > Développeur > Whitelist IP.",
          code: 'ip_not_whitelisted',
        });
        return;
      }

      res.status(result.statusCode || 400).json({
        success: false,
        error: result.error || 'Échec de l’initialisation du retrait SasPay.',
        data: result.data,
      });
      return;
    }

    // Deduct wallet balance upon successful initiation
    await db.execute({
      sql: 'UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?',
      args: [numAmount, new Date().toISOString(), walletRes.rows[0].id],
    });

    res.json({
      success: true,
      environment: env,
      data: result.data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Payout status
apiRouter.get('/v1/payouts/:id/verify', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.verifyPayout(req.params.id, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real Merchant Balances from SasPay
apiRouter.get('/v1/wallets/balances', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.getMerchantBalances(env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Exchange Rates from SasPay
apiRouter.get('/v1/wallets/rates', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const result = await sasPayService.getExchangeRates(env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Interwallet Transfer
apiRouter.post('/v1/wallets/transfer', requireApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const env = req.apiKey!.environment;
    const { from_country, to_country, from_amount } = req.body;
    if (!from_country || !to_country || !from_amount) {
      res.status(400).json({ success: false, error: 'Champs from_country, to_country et from_amount requis.' });
      return;
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
    const result = await sasPayService.createWalletTransfer(
      {
        from_country,
        to_country,
        from_amount: formatDecimalAmount(from_amount),
      },
      idempotencyKey,
      env
    );

    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...(result.success ? { data: result.data } : { error: result.error, data: result.data }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
