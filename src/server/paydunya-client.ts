import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { getDb } from './db';

export interface CreateInvoiceParams {
  amount: number;
  description: string;
  reference?: string;
  storeName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  callbackUrl?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  applicationId?: string;
  paymentLinkId?: string;
}

export interface InvoiceResult {
  token: string;
  invoiceUrl: string;
  reference: string;
  isSimulated: false;
  status: 'pending' | 'failed';
  gatewayResponseCode?: string;
  gatewayResponseText?: string;
  error?: string;
}

type InvoiceStatus = 'completed' | 'pending' | 'canceled' | 'failed';

interface PayDunyaConfig {
  mode: 'sandbox' | 'live';
  masterKey: string;
  privateKey: string;
  token: string;
}

interface PayDunyaResponse {
  response_code?: string;
  response_text?: string;
  token?: string;
  status?: string;
  hash?: string;
  invoice?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
  [key: string]: unknown;
}

function getPayDunyaConfig(): PayDunyaConfig {
  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const configuredMode = process.env.PAYDUNYA_MODE?.trim().toLowerCase();
  const mode = configuredMode || (production ? '' : 'sandbox');
  if (mode !== 'sandbox' && mode !== 'live') {
    throw new Error('PAYDUNYA_MODE must be explicitly set to sandbox or live in production.');
  }

  const masterKey = process.env.PAYDUNYA_MASTER_KEY?.trim() || '';
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY?.trim() || '';
  const token = process.env.PAYDUNYA_TOKEN?.trim() || '';
  if (!masterKey || !privateKey || !token) {
    throw new Error('PayDunya credentials are not fully configured.');
  }
  if (mode === 'live' && privateKey.toLowerCase().includes('test_')) {
    throw new Error('A sandbox private key cannot be used in live mode.');
  }

  return { mode, masterKey, privateKey, token };
}

function apiBaseUrl(mode: PayDunyaConfig['mode']): string {
  return mode === 'sandbox'
    ? 'https://app.paydunya.com/sandbox-api/v1'
    : 'https://app.paydunya.com/api/v1';
}

function isSuccessfulInvoiceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'paydunya.com' || url.hostname.endsWith('.paydunya.com'));
  } catch {
    return false;
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19));
  }

  const normalized = address.toLowerCase();
  return normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.');
}

async function assertPublicHttpsUrl(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new Error('Webhook URL must use a public HTTPS host.');
  }

  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error('Webhook URL cannot target a private address.');
    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Webhook URL must resolve only to public addresses.');
  }
}

export class PayDunyaService {
  private async request(path: string, method: 'GET' | 'POST', body?: string): Promise<PayDunyaResponse> {
    const config = getPayDunyaConfig();
    const response = await fetch(`${apiBaseUrl(config.mode)}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': config.masterKey,
        'PAYDUNYA-PRIVATE-KEY': config.privateKey,
        'PAYDUNYA-TOKEN': config.token,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`PayDunya returned HTTP ${response.status}.`);
    }
    return await response.json() as PayDunyaResponse;
  }

  public async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
    const reference = params.reference || `pf_${crypto.randomUUID()}`;
    if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
      throw new Error('PayDunya invoice amount must be a positive integer.');
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    if (!appUrl) throw new Error('APP_URL must be configured to create a PayDunya invoice.');
    const payload = JSON.stringify({
      invoice: {
        total_amount: params.amount,
        description: params.description,
        customer: {
          name: params.customerName || '',
          email: params.customerEmail || '',
          phone: params.customerPhone || '',
        },
      },
      store: { name: params.storeName || 'PichFlow' },
      custom_data: {
        reference,
        application_id: params.applicationId || '',
        payment_link_id: params.paymentLinkId || '',
      },
      actions: {
        cancel_url: params.cancelUrl || `${appUrl}/checkout-demo?status=cancel&ref=${encodeURIComponent(reference)}`,
        return_url: params.returnUrl || `${appUrl}/checkout-demo?ref=${encodeURIComponent(reference)}`,
        callback_url: params.callbackUrl || `${appUrl}/api/webhooks/paydunya`,
      },
    });

    const result = await this.request('/checkout-invoice/create', 'POST', payload);
    if (result.response_code !== '00' || typeof result.token !== 'string' ||
        !isSuccessfulInvoiceUrl(result.response_text)) {
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        gatewayResponseCode: result.response_code,
        gatewayResponseText: result.response_text,
        error: 'PayDunya did not create a valid checkout invoice.',
      };
    }

    return {
      token: result.token,
      invoiceUrl: result.response_text,
      reference,
      isSimulated: false,
      status: 'pending',
      gatewayResponseCode: result.response_code,
      gatewayResponseText: result.response_text,
    };
  }

  public async confirmInvoice(token: string): Promise<{
    status: InvoiceStatus;
    data?: PayDunyaResponse;
    error?: string;
  }> {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(token)) {
      throw new Error('Invalid PayDunya invoice token.');
    }

    const result = await this.request(`/checkout-invoice/confirm/${encodeURIComponent(token)}`, 'GET');
    const status = String(result.status || '').toLowerCase();
    if (result.response_code !== '00' && status !== 'completed' &&
        status !== 'cancelled' && status !== 'canceled' && status !== 'failed') {
      return { status: 'pending', data: result, error: 'PayDunya has not confirmed a final payment status.' };
    }
    if (status === 'completed') return { status, data: result };
    if (status === 'cancelled' || status === 'canceled') return { status: 'canceled', data: result };
    if (status === 'failed') return { status, data: result };
    return { status: 'pending', data: result };
  }

  public verifyNotificationHash(receivedHash: unknown): boolean {
    if (typeof receivedHash !== 'string' || !/^[a-f0-9]{128}$/i.test(receivedHash)) return false;
    const { masterKey } = getPayDunyaConfig();
    const expected = crypto.createHash('sha512').update(masterKey).digest();
    const received = Buffer.from(receivedHash, 'hex');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }
}

export const paydunyaService = new PayDunyaService();

export async function dispatchMerchantWebhook(
  userId: string,
  applicationId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const db = getDb();
  const webhooks = await db.execute({
    sql: 'SELECT id, url, secret FROM webhooks WHERE user_id = ? AND application_id = ? AND is_active = 1',
    args: [userId, applicationId],
  });

  for (const webhook of webhooks.rows) {
    const webhookId = String(webhook.id);
    const eventId = `evt_${crypto.randomUUID()}`;
    const payload = JSON.stringify({
      id: eventId,
      event,
      created_at: new Date().toISOString(),
      data,
    });
    const signature = crypto.createHmac('sha256', String(webhook.secret)).update(payload).digest('hex');
    let statusCode = 0;
    let responseBody = '';
    let success = 0;

    try {
      const url = String(webhook.url);
      await assertPublicHttpsUrl(url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PichFlow-Event': event,
          'X-PichFlow-Signature': signature,
        },
        body: payload,
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      statusCode = response.status;
      responseBody = (await response.text()).slice(0, 2048);
      success = response.ok ? 1 : 0;
    } catch (error) {
      responseBody = error instanceof Error ? error.message.slice(0, 2048) : 'Webhook delivery failed.';
    }

    await db.execute({
      sql: `INSERT INTO webhook_logs
        (id, webhook_id, user_id, event, payload, status_code, response_body, success, attempts, external_event_id, signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [
        `wlog_${crypto.randomUUID()}`,
        webhookId,
        userId,
        event,
        payload,
        statusCode,
        responseBody,
        success,
        eventId,
        signature,
        new Date().toISOString(),
      ],
    });

    if (!success) {
      await db.execute({
        sql: 'UPDATE webhooks SET last_delivery_status = ? WHERE id = ? AND user_id = ? AND application_id = ?',
        args: [`failed:${statusCode || 'network'}`, webhookId, userId, applicationId],
      });
      continue;
    }

    await db.execute({
      sql: 'UPDATE webhooks SET last_delivery_status = ? WHERE id = ? AND user_id = ? AND application_id = ?',
      args: [`success:${statusCode}`, webhookId, userId, applicationId],
    });
  }
}
