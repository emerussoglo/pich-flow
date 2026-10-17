import nodemailer, { type Transporter } from 'nodemailer';

let primaryTransporter: Transporter | null = null;
let testTransporter: Transporter | null = null;
let primarySmtpFailed = false;
let lastSmtpCheck = 0;

/**
 * Parses user-agent header into a clean human-readable device/browser label
 * for user-facing security notifications.
 */
export function parseUserAgent(ua: string): string {
  if (!ua || ua === 'Unknown') return 'Appareil inconnu';

  let browser = 'Navigateur Web';
  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';

  let os = 'Système';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone/i.test(ua)) os = 'iPhone';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  return `${browser} sur ${os}`;
}

/**
 * Formats a Date object into both UTC and local representations.
 */
export function formatLoginDate(date: Date = new Date()): { utcString: string; localString: string } {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  
  const d = pad(date.getUTCDate());
  const m = pad(date.getUTCMonth() + 1);
  const y = date.getUTCFullYear();
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const utcString = `${d}/${m}/${y} ${h}:${min} UTC`;

  const localString = date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return { utcString, localString };
}

async function getTransporter(): Promise<{ transport: Transporter; isFallback: boolean }> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || '465');
  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Configuration SMTP invalide : SMTP_PORT doit être un port TCP valide.');
  }
  if (secureSetting && secureSetting !== 'true' && secureSetting !== 'false') {
    throw new Error('Configuration SMTP invalide : SMTP_SECURE doit valoir true ou false.');
  }
  const secure = secureSetting ? secureSetting === 'true' : port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');

  // In test environment, use mock JSON transport for deterministic test runs
  if (process.env.NODE_ENV === 'test' || process.env.SMTP_MOCK === 'true') {
    if (!testTransporter) {
      testTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
    return { transport: testTransporter, isFallback: true };
  }

  if (!user || !pass || pass.length < 8) {
    throw new Error(
      'Configuration SMTP incomplète : Veuillez renseigner SMTP_USER et SMTP_PASSWORD dans votre fichier .env.'
    );
  }

  if (!primaryTransporter) {
    primaryTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  try {
    await primaryTransporter.verify();
    return { transport: primaryTransporter, isFallback: false };
  } catch (err: any) {
    primaryTransporter = null;
    console.error(`[PichFlow Email] ❌ Échec de vérification SMTP (${host}:${port}) : ${err.message}`);
    if (err.message && err.message.includes('535')) {
      throw new Error(
        `Identifiants Gmail refusés (535 Bad Credentials) pour "${user}". ` +
        `Pour Gmail, générez un "Mot de passe d'application" (16 lettres sans espace) sur : ` +
        `https://myaccount.google.com/apppasswords puis mettez à jour SMTP_PASSWORD dans .env.`
      );
    }
    throw new Error(`Échec de connexion au serveur SMTP (${host}:${port}) : ${err.message}`);
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; isFallback: boolean; messageId?: string; previewUrl?: string }> {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'contactpichflow@gmail.com';

  try {
    const { transport, isFallback } = await getTransporter();
    const info = await transport.sendMail({
      from: `"PichFlow" <${from}>`,
      to,
      subject,
      text,
      html,
    });

    if (isFallback) {
      console.log(`[PichFlow Email] [Test Mode] Email intercepté pour ${to} (${subject})`);
    } else {
      console.log(`[PichFlow Email] ✅ Email délivré avec succès via SMTP à ${to} (MessageId: ${info.messageId})`);
    }

    return { success: true, isFallback, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[PichFlow Email] ❌ Erreur lors de l'envoi de l'e-mail à ${to}:`, error.message);
    throw error;
  }
}

/**
 * 1. Envoi du code de confirmation d'inscription (Email verification code)
 */
export async function sendVerificationCodeEmail(to: string, code: string, fullName?: string): Promise<boolean> {
  const name = fullName ? fullName.trim() : 'Cher créateur';
  const subject = `Votre code de validation PichFlow : ${code}`;
  const text = `Bonjour ${name},\n\nVotre code de confirmation PichFlow est : ${code}\nCe code est valable pendant 15 minutes.\n\nSaisissez ce code sur la plateforme pour finaliser l'activation de votre compte et commencer à encaisser vos paiements.\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.\n\nL'équipe PichFlow — Infrastructure de paiement pour l'Afrique.`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #0f172a; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }
        .head { padding: 24px 32px; background: #0f172a; border-bottom: 1px solid #1e293b; }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; text-decoration: none; }
        .logo-accent { color: #6366f1; }
        .badge { display: block; font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .body { padding: 32px; }
        .title { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a; }
        .text { margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6; }
        .code-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; }
        .code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #2563eb; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .hint { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
        .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="head">
          <span class="logo">⚡ Pich<span class="logo-accent">Flow</span></span>
          <span class="badge">Vérification de compte</span>
        </div>
        <div class="body">
          <h2 class="title">Confirmez votre adresse email</h2>
          <p class="text">
            Bonjour <strong>${name}</strong>,<br/>
            Merci de rejoindre <strong>PichFlow</strong>. Veuillez saisir le code de sécurité suivant pour activer votre espace et commencer à créer vos liens de paiement :
          </p>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="hint">⏱️ Valable pendant 15 minutes • Usage unique</div>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
            Si vous n'êtes pas à l'origine de cette demande de création de compte, vous pouvez ignorer cet e-mail en toute sérénité.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PichFlow SAS • Infrastructure de paiement pour l'Afrique.<br/>
          Cotonou • Abidjan • Dakar • Lomé
        </div>
      </div>
    </body>
    </html>
  `;

  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}

/**
 * 2. Alerte de sécurité de connexion
 * Affiche la date UTC/Locale, l'adresse IP, le nom de l'appareil et le bouton d'action.
 */
export async function sendLoginNotificationEmail(
  to: string,
  fullName: string,
  details: { ip: string; userAgent: string; time?: string }
): Promise<boolean> {
  const name = fullName ? fullName.trim() : 'Cher créateur';
  const { utcString, localString } = formatLoginDate();
  const humanDevice = parseUserAgent(details.userAgent);
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const securitySettingsUrl = `${appUrl}/dashboard/settings`;

  const subject = `Nouvelle connexion détectée — PichFlow`;
  const text = `Nouvelle connexion détectée\n\nBonjour ${name},\nUne nouvelle connexion a été détectée sur votre compte PichFlow.\n\nDate : ${utcString} (${localString})\nAdresse IP : ${details.ip}\nAppareil : ${humanDevice} (${details.userAgent})\n\nC'était vous ? Aucune action requise.\nCe n'était pas vous ? Changez votre mot de passe immédiatement : ${securitySettingsUrl}\n\nL'équipe PichFlow Sécurité.`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body { margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }
        .header { padding: 24px 32px; background: #0f172a; border-bottom: 1px solid #1e293b; }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo-accent { color: #6366f1; }
        .tagline { display: block; font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .content { padding: 32px; }
        .title { margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #0f172a; }
        .lead { margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6; }
        .meta-table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px; overflow: hidden; }
        .meta-table td { padding: 14px 18px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .meta-table tr:last-child td { border-bottom: none; }
        .label { display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
        .val { font-size: 14px; font-weight: 600; color: #0f172a; }
        .mono { font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .ua-sub { display: block; font-size: 11px; color: #64748b; margin-top: 4px; word-break: break-all; font-family: monospace; }
        .box-ok { padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; font-size: 13px; color: #166534; line-height: 1.5; margin-bottom: 10px; }
        .box-warn { padding: 12px 16px; background: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px; font-size: 13px; color: #9a3412; line-height: 1.5; }
        .btn-wrapper { text-align: center; margin: 28px 0 12px; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); }
        .footer { padding: 22px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">⚡ Pich<span class="logo-accent">Flow</span></div>
          <span class="tagline">Alerte de sécurité de connexion</span>
        </div>
        <div class="content">
          <h1 class="title">Nouvelle connexion détectée</h1>
          <p class="lead">
            Bonjour <strong>${name}</strong>,<br/>
            Une nouvelle connexion a été détectée sur votre compte <strong>PichFlow</strong>.
          </p>

          <table class="meta-table" role="presentation">
            <tr>
              <td>
                <span class="label">Date</span>
                <span class="val">${utcString}</span>
                <span style="display:block; font-size:12px; color:#64748b; margin-top:2px;">(${localString})</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="label">Adresse IP</span>
                <span class="val mono">${details.ip}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="label">Appareil</span>
                <span class="val">${humanDevice}</span>
                <span class="ua-sub">${details.userAgent}</span>
              </td>
            </tr>
          </table>

          <div class="box-ok">
            <strong>C'était vous ?</strong> Aucune action requise.
          </div>
          <div class="box-warn">
            <strong>Ce n'était pas vous ?</strong> Changez votre mot de passe immédiatement pour sécuriser vos fonds et vos flux de paiement.
          </div>

          <div class="btn-wrapper">
            <a href="${securitySettingsUrl}" class="btn">Changer mon mot de passe &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PichFlow SAS • Infrastructure de paiement pour l'Afrique et les créateurs.<br/>
          Cet e-mail de sécurité automatique a été envoyé à <strong>${to}</strong>.
        </div>
      </div>
    </body>
    </html>
  `;

  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}

export async function sendPasswordResetEmail(to: string, code: string, fullName?: string): Promise<boolean> {
  const name = fullName ? fullName.trim() : 'Cher utilisateur';
  const subject = `Réinitialisation de votre mot de passe PichFlow : ${code}`;
  const text = `Bonjour ${name},\n\nVous avez demandé la réinitialisation de votre mot de passe PichFlow.\nVotre code de réinitialisation est : ${code}\nCe code expire dans 15 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez ignorer ce message.\n\nL'équipe PichFlow.`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; display: inline-block; }
        .code-box { background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace; }
        .hint { font-size: 13px; color: #7f1d1d; line-height: 1.5; margin-top: 8px; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">⚡ PichFlow</div>
        <h2 style="margin: 0 0 12px; font-size: 20px; color: #0f172a;">Réinitialisation de votre mot de passe</h2>
        <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.5;">
          Bonjour <strong>${name}</strong>,<br/>
          Une demande de réinitialisation de mot de passe a été formulée pour votre compte. Utilisez le code ci-dessous :
        </p>
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="hint">Valable pendant 15 minutes • Usage unique</div>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Si vous n'êtes pas à l'origine de cette demande, votre mot de passe reste inchangé et votre compte est en sécurité.
        </p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PichFlow SAS. Tous droits réservés.
        </div>
      </div>
    </body>
    </html>
  `;

  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}

export async function sendPasswordChangedNotificationEmail(to: string, fullName: string): Promise<boolean> {
  const name = fullName ? fullName.trim() : 'Cher partenaire';
  const subject = 'Confirmation : Mot de passe modifié sur PichFlow';
  const text = `Bonjour ${name},\n\nLe mot de passe de votre compte PichFlow a été modifié avec succès.\n\nSi vous êtes à l'origine de ce changement, aucune action n'est requise.\nSi vous n'avez pas modifié votre mot de passe, contactez immédiatement l'assistance PichFlow.\n\nL'équipe PichFlow.`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; display: inline-block; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">⚡ PichFlow</div>
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Mot de passe mis à jour</h2>
        <p style="margin: 0 0 16px; color: #475569; font-size: 14px; line-height: 1.5;">
          Bonjour <strong>${name}</strong>,<br/>
          Le mot de passe associé à votre compte PichFlow a été modifié avec succès le ${new Date().toLocaleString('fr-FR')}.
        </p>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Si vous n'êtes pas l'auteur de cette modification, veuillez contacter sans délai notre équipe de support pour sécuriser votre compte.
        </p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} PichFlow SAS. Tous droits réservés.
        </div>
      </div>
    </body>
    </html>
  `;

  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}
