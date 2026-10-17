import crypto from 'node:crypto';
import { getDb } from './db';
import { dispatchMerchantWebhook, paydunyaService } from './paydunya';

type CheckoutStatus = 'pending' | 'success' | 'cancelled' | 'failed';

interface CheckoutSession {
  id: string;
  payment_link_id: string | null;
  application_id: string | null;
  user_id: string | null;
  reference: string;
  amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  paydunya_token: string | null;
  paydunya_url: string | null;
  provider: string | null;
}

interface CheckoutInput {
  amount?: unknown;
  currency?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  paymentLinkId?: unknown;
  paymentLinkSlug?: unknown;
  slug?: unknown;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

function validateCustomer(input: CheckoutInput) {
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  const customerEmail = typeof input.customerEmail === 'string' ? input.customerEmail.trim().toLowerCase() : '';
  const phone = typeof input.customerPhone === 'string' ? input.customerPhone.trim() : '';
  const normalizedPhone = phone.replace(/[\s().-]/g, '');

  if (!customerName || customerName.length > 160) {
    throw new CheckoutError('Le nom du client est requis.', 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 254) {
    throw new CheckoutError('Une adresse e-mail valide est requise.', 400);
  }
  if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new CheckoutError('Un numéro de téléphone valide est requis.', 400);
  }
  return { customerName, customerEmail, customerPhone: normalizedPhone };
}

function checkoutResponse(session: CheckoutSession) {
  const invoiceUrl = session.paydunya_url || '';
  return {
    success: true,
    reference: session.reference,
    token: session.paydunya_token || session.reference,
    invoiceUrl,
    checkoutUrl: invoiceUrl,
    status: session.status,
    amount: Number(session.amount),
    currency: session.currency,
    isSimulated: false,
  };
}

export async function createCheckout(
  input: CheckoutInput,
  requestedIdempotencyKey?: string | null,
) {
  const db = getDb();
  const paymentLinkId = typeof input.paymentLinkId === 'string' ? input.paymentLinkId.trim() : '';
  const paymentLinkSlug = typeof (input.paymentLinkSlug || input.slug) === 'string'
    ? String(input.paymentLinkSlug || input.slug).trim()
    : '';
  if (Boolean(paymentLinkId) === Boolean(paymentLinkSlug)) {
    throw new CheckoutError('Un seul lien de paiement est requis.', 400);
  }

  const linkResult = await db.execute({
    sql: `SELECT l.id, l.user_id, l.application_id, l.title, l.description, l.amount,
                 l.is_fixed_amount, l.currency, l.status, l.usage_count, l.usage_limit,
                 a.name AS application_name
          FROM payment_links l
          JOIN applications a ON a.id = l.application_id AND a.user_id = l.user_id
          WHERE ${paymentLinkId ? 'l.id = ?' : 'l.slug = ?'}
          LIMIT 1`,
    args: [paymentLinkId || paymentLinkSlug],
  });
  const link = linkResult.rows[0];
  if (!link) throw new CheckoutError('Lien de paiement introuvable.', 404);
  if (String(link.status) !== 'active') throw new CheckoutError('Ce lien de paiement n’est plus actif.', 410);

  const currency = String(link.currency || 'XOF').toUpperCase();
  if (currency !== 'XOF') {
    throw new CheckoutError('La devise de ce lien n’est pas prise en charge par la configuration PayDunya actuelle.', 400);
  }

  const fixedAmount = Number(link.amount);
  const amount = Number(link.is_fixed_amount)
    ? fixedAmount
    : Number(input.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new CheckoutError('Le montant doit être un nombre entier positif en XOF.', 400);
  }
  if (Number(link.is_fixed_amount) && (!Number.isSafeInteger(fixedAmount) || fixedAmount <= 0)) {
    throw new CheckoutError('Le montant configuré pour ce lien est invalide.', 409);
  }

  const usageCount = Number(link.usage_count || 0);
  const usageLimit = link.usage_limit === null ? null : Number(link.usage_limit);
  if (usageLimit !== null && usageCount >= usageLimit) {
    throw new CheckoutError('Ce lien a atteint sa limite d’utilisation.', 410);
  }

  const { customerName, customerEmail, customerPhone } = validateCustomer(input);
  const suppliedKey = requestedIdempotencyKey?.trim();
  if (suppliedKey && !/^[A-Za-z0-9._:-]{8,100}$/.test(suppliedKey)) {
    throw new CheckoutError('La clé d’idempotence est invalide.', 400);
  }
  const idempotencyKey = `paydunya:${suppliedKey || crypto.randomUUID()}`;
  const existing = await db.execute({
    sql: 'SELECT * FROM checkout_sessions WHERE idempotency_key = ? LIMIT 1',
    args: [idempotencyKey],
  });
  if (existing.rows[0]) {
    const prior = existing.rows[0] as unknown as CheckoutSession;
    if (prior.payment_link_id !== String(link.id)) {
      throw new CheckoutError('Cette clé d’idempotence a déjà été utilisée pour une autre opération.', 409);
    }
    if (prior.status === 'failed' || prior.status === 'cancelled') {
      throw new CheckoutError('Cette tentative de paiement est terminée. Créez une nouvelle tentative.', 409);
    }
    return checkoutResponse(prior);
  }

  const reference = `pf_${crypto.randomUUID()}`;
  const sessionId = `cs_${crypto.randomUUID()}`;
  const transactionId = `txn_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const userId = String(link.user_id);
  const applicationId = String(link.application_id);
  const description = String(link.description || link.title || 'Paiement PitchFlow');
  const tx = await db.transaction('write');
  try {
    const usageUpdate = await tx.execute({
      sql: `UPDATE payment_links SET usage_count = usage_count + 1, updated_at = ?
            WHERE id = ? AND user_id = ? AND application_id = ? AND status = 'active'
              AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      args: [now, link.id, userId, applicationId],
    });
    if (usageUpdate.rowsAffected !== 1) {
      throw new CheckoutError('Ce lien a atteint sa limite d’utilisation ou n’est plus actif.', 410);
    }

    await tx.execute({
      sql: `INSERT INTO checkout_sessions
        (id, payment_link_id, application_id, user_id, reference, amount, currency,
         customer_name, customer_email, customer_phone, status, paydunya_token,
         paydunya_url, idempotency_key, provider, payment_method, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, 'paydunya', 'PayDunya checkout', ?, ?)`,
      args: [
        sessionId, link.id, applicationId, userId, reference, amount, currency,
        customerName, customerEmail, customerPhone, idempotencyKey, now, now,
      ],
    });
    await tx.execute({
      sql: `INSERT INTO transactions
        (id, user_id, application_id, reference, external_id, customer_name, customer_email,
         customer_phone, country, provider, amount, provider_fee, platform_fee, customer_fee,
         net_amount, currency, status, description, payment_method, metadata, created_at,
         updated_at, idempotency_key)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'BJ', 'paydunya', ?, NULL, 0, 0, ?, ?,
                'pending', ?, 'PayDunya checkout', ?, ?, ?, ?)`,
      args: [
        transactionId, userId, applicationId, reference, customerName, customerEmail,
        customerPhone, amount, amount, currency, description,
        JSON.stringify({ paymentLinkId: String(link.id) }), now, now, idempotencyKey,
      ],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  let invoice;
  try {
    invoice = await paydunyaService.createInvoice({
      amount,
      description,
      reference,
      storeName: String(link.application_name || 'PichFlow'),
      customerName,
      customerEmail,
      customerPhone,
      applicationId,
      paymentLinkId: String(link.id),
    });
  } catch (error) {
    await db.execute({
      sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [new Date().toISOString(), reference],
    });
    await db.execute({
      sql: `UPDATE transactions SET status = 'failed', updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [new Date().toISOString(), reference],
    });
    throw error;
  }

  if (invoice.status !== 'pending' || !invoice.token || !invoice.invoiceUrl) {
    await db.execute({
      sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [new Date().toISOString(), reference],
    });
    await db.execute({
      sql: `UPDATE transactions SET status = 'failed', updated_at = ?
            WHERE reference = ? AND status = 'pending'`,
      args: [new Date().toISOString(), reference],
    });
    throw new CheckoutError(invoice.error || 'PayDunya n’a pas créé la facture.', 502);
  }

  await db.execute({
    sql: `UPDATE checkout_sessions
          SET paydunya_token = ?, paydunya_url = ?, updated_at = ?
          WHERE reference = ? AND status = 'pending'`,
    args: [invoice.token, invoice.invoiceUrl, new Date().toISOString(), reference],
  });
  await db.execute({
    sql: `UPDATE transactions SET external_id = ?, updated_at = ?
          WHERE reference = ? AND application_id = ? AND user_id = ? AND status = 'pending'`,
    args: [invoice.token, new Date().toISOString(), reference, applicationId, userId],
  });

  return {
    success: true,
    reference,
    token: invoice.token,
    invoiceUrl: invoice.invoiceUrl,
    checkoutUrl: invoice.invoiceUrl,
    baseAmount: amount,
    feeAmount: 0,
    totalAmount: amount,
    isPushDirect: false,
    isSimulated: false,
    status: 'pending' as const,
  };
}

async function settleConfirmedSession(session: CheckoutSession, confirmed: Record<string, unknown>) {
  const invoice = confirmed.invoice && typeof confirmed.invoice === 'object'
    ? confirmed.invoice as Record<string, unknown>
    : {};
  const customData = confirmed.custom_data && typeof confirmed.custom_data === 'object'
    ? confirmed.custom_data as Record<string, unknown>
    : {};
  if (String(invoice.token || '') !== String(session.paydunya_token || '') ||
      Number(invoice.total_amount) !== Number(session.amount) ||
      String(customData.reference || '') !== session.reference) {
    throw new CheckoutError('Les données confirmées par PayDunya ne correspondent pas à la commande.', 409);
  }
  if (!session.user_id || !session.application_id) {
    throw new CheckoutError('La session ne possède pas de propriétaire valide.', 409);
  }

  const now = new Date().toISOString();
  const tx = await getDb().transaction('write');
  try {
    const claim = await tx.execute({
      sql: `UPDATE checkout_sessions SET status = 'success', updated_at = ?
            WHERE reference = ? AND status = 'pending' AND provider = 'paydunya'
              AND paydunya_token = ?`,
      args: [now, session.reference, session.paydunya_token],
    });
    if (claim.rowsAffected !== 1) {
      await tx.rollback();
      return false;
    }

    const transaction = await tx.execute({
      sql: `UPDATE transactions SET status = 'success', external_id = ?, updated_at = ?
            WHERE reference = ? AND application_id = ? AND user_id = ? AND status = 'pending'`,
      args: [session.paydunya_token, now, session.reference, session.application_id, session.user_id],
    });
    if (transaction.rowsAffected !== 1) {
      throw new Error('Could not claim the pending transaction for settlement.');
    }

    await tx.execute({
      sql: `INSERT OR IGNORE INTO wallets
        (id, user_id, application_id, currency, symbol, balance, pending_balance,
         reserved_balance, country_code, is_default, created_at, updated_at)
        VALUES (?, ?, ?, 'XOF', 'FCFA', 0, 0, 0, 'BJ',
                CASE WHEN NOT EXISTS (
                  SELECT 1 FROM wallets WHERE user_id = ? AND application_id = ?
                ) THEN 1 ELSE 0 END, ?, ?)`,
      args: [
        `wal_${crypto.randomUUID()}`, session.user_id, session.application_id,
        session.user_id, session.application_id, now, now,
      ],
    });
    await tx.execute({
      sql: `UPDATE wallets SET pending_balance = pending_balance + ?, updated_at = ?
            WHERE user_id = ? AND application_id = ? AND currency = 'XOF'`,
      args: [Number(session.amount), now, session.user_id, session.application_id],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  await dispatchMerchantWebhook(session.user_id, session.application_id, 'payment.succeeded', {
    reference: session.reference,
    amount: Number(session.amount),
    currency: session.currency,
    status: 'success',
  });
  return true;
}

async function setFinalFailure(session: CheckoutSession, status: 'cancelled' | 'failed') {
  const now = new Date().toISOString();
  const db = getDb();
  await db.execute({
    sql: `UPDATE checkout_sessions SET status = ?, updated_at = ?
          WHERE reference = ? AND status = 'pending' AND provider = 'paydunya'`,
    args: [status, now, session.reference],
  });
  await db.execute({
    sql: `UPDATE transactions SET status = ?, updated_at = ?
          WHERE reference = ? AND application_id = ? AND user_id = ? AND status = 'pending'`,
    args: [status, now, session.reference, session.application_id, session.user_id],
  });
}

async function getSession(reference: string): Promise<CheckoutSession | null> {
  const result = await getDb().execute({
    sql: `SELECT id, payment_link_id, application_id, user_id, reference, amount, currency,
                 customer_name, customer_email, customer_phone, status, paydunya_token,
                 paydunya_url, provider
          FROM checkout_sessions WHERE reference = ? AND provider = 'paydunya' LIMIT 1`,
    args: [reference],
  });
  return result.rows[0] ? result.rows[0] as unknown as CheckoutSession : null;
}

export async function getCheckoutStatus(reference: string) {
  if (!/^pf_[0-9a-f-]{36}$/i.test(reference)) {
    throw new CheckoutError('Référence de paiement invalide.', 400);
  }
  const session = await getSession(reference);
  if (!session) throw new CheckoutError('Session introuvable.', 404);

  let status = session.status as CheckoutStatus;
  if (status === 'pending') {
    if (!session.paydunya_token) {
      return { success: true, reference, status, amount: Number(session.amount), currency: session.currency };
    }
    const result = await paydunyaService.confirmInvoice(session.paydunya_token);
    if (result.status === 'completed' && result.data) {
      await settleConfirmedSession(session, result.data);
      status = (await getSession(reference))?.status as CheckoutStatus || 'pending';
    } else if (result.status === 'canceled' || result.status === 'failed') {
      await setFinalFailure(session, result.status === 'canceled' ? 'cancelled' : 'failed');
      status = result.status === 'canceled' ? 'cancelled' : 'failed';
    }
  }

  return { success: status !== 'failed' && status !== 'cancelled', reference, status, amount: Number(session.amount), currency: session.currency };
}

export async function handlePayDunyaNotification(notification: Record<string, unknown>) {
  const data = notification.data && typeof notification.data === 'object'
    ? notification.data as Record<string, unknown>
    : notification;
  if (!paydunyaService.verifyNotificationHash(data.hash)) {
    throw new CheckoutError('Notification PayDunya non authentifiée.', 401);
  }
  const notifiedInvoice = data.invoice && typeof data.invoice === 'object'
    ? data.invoice as Record<string, unknown>
    : {};
  const token = String(notifiedInvoice.token || data.token || '');
  if (!token) throw new CheckoutError('Token de facture PayDunya manquant.', 400);

  const result = await paydunyaService.confirmInvoice(token);
  const db = getDb();
  const sessionResult = await db.execute({
    sql: `SELECT id, payment_link_id, application_id, user_id, reference, amount, currency,
                 customer_name, customer_email, customer_phone, status, paydunya_token,
                 paydunya_url, provider
          FROM checkout_sessions WHERE paydunya_token = ? AND provider = 'paydunya' LIMIT 1`,
    args: [token],
  });
  if (!sessionResult.rows[0]) throw new CheckoutError('Session de paiement introuvable.', 404);
  const session = sessionResult.rows[0] as unknown as CheckoutSession;
  if (result.status === 'completed' && result.data) {
    await settleConfirmedSession(session, result.data);
  } else if (result.status === 'canceled' || result.status === 'failed') {
    await setFinalFailure(session, result.status === 'canceled' ? 'cancelled' : 'failed');
  } else {
    throw new CheckoutError('PayDunya n’a pas encore confirmé le statut final.', 503);
  }
}
