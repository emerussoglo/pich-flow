import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '../config/payments';
import { getDb } from './db';
import { getAppBaseUrl, getPayDunyaCallbackUrl } from './urls';

dotenv.config();

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
}

export interface InvoiceResult {
  token: string;
  invoiceUrl: string;
  reference: string;
  isSimulated: boolean;
  status: 'pending' | 'success' | 'failed';
  gatewayResponseCode?: string;
  gatewayResponseText?: string;
  error?: string;
}

interface PayDunyaApiResponse {
  response_code?: string;
  response_text?: string;
  token?: string;
  [key: string]: unknown;
}

export class PayDunyaService {
  private readonly masterKey: string;
  private readonly privateKey: string;
  private readonly token: string;
  private readonly mode: 'sandbox' | 'live';

  constructor() {
    this.masterKey = (process.env.PAYDUNYA_MASTER_KEY || '').trim();
    this.privateKey = (process.env.PAYDUNYA_PRIVATE_KEY || '').trim();
    this.token = (process.env.PAYDUNYA_TOKEN || '').trim();
    const configuredMode = (process.env.PAYDUNYA_MODE || '').trim().toLowerCase();
    this.mode = configuredMode === 'sandbox'
      ? 'sandbox'
      : configuredMode === 'live' || configuredMode === 'production'
        ? 'live'
        : 'sandbox';
    this.configurationError = !['sandbox', 'live', 'production'].includes(configuredMode)
      ? 'PAYDUNYA_MODE must be set to sandbox or live.'
      : !this.masterKey || !this.privateKey || !this.token
        ? 'PayDunya server credentials are incomplete.'
        : '';
  }

  private readonly configurationError: string;

  public get isSandbox(): boolean {
    return this.mode === 'sandbox';
  }

  public verifyCallbackHash(hash: string): boolean {
    if (!this.masterKey || !/^[a-f0-9]{128}$/i.test(hash)) return false;
    const expected = crypto.createHash('sha512').update(this.masterKey).digest();
    const received = Buffer.from(hash, 'hex');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }

  public async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
    const reference = params.reference || `PF-${crypto.randomUUID()}`;

    if (this.configurationError) {
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        error: this.configurationError,
      };
    }
    if (!Number.isSafeInteger(params.amount) || params.amount < PAYDUNYA_MINIMUM_AMOUNT_XOF) {
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        error: `Le montant minimum accepté par PayDunya est de ${PAYDUNYA_MINIMUM_AMOUNT_XOF} XOF.`,
      };
    }

    const payload = JSON.stringify({
      invoice: {
        total_amount: params.amount,
        description: params.description,
        customer: {
          name: params.customerName,
          email: params.customerEmail,
          phone: params.customerPhone,
        },
      },
      store: {
        name: params.storeName || 'PichFlow Merchant',
      },
      custom_data: {
        reference,
      },
      actions: {
        cancel_url: params.cancelUrl || `${getAppBaseUrl()}/checkout-demo?status=cancel`,
        return_url: params.returnUrl || `${getAppBaseUrl()}/checkout-demo?status=success&ref=${reference}`,
        callback_url: params.callbackUrl || getPayDunyaCallbackUrl(),
      },
    });

    let result: PayDunyaApiResponse | undefined;
    try {
      result = await this.callPayDunyaApi('/checkout-invoice/create', payload);
      if (
        result &&
        result.response_code === '00' &&
        typeof result.token === 'string' &&
        typeof result.response_text === 'string' &&
        isPayDunyaInvoiceUrl(result.response_text)
      ) {
        return {
          token: result.token,
          invoiceUrl: result.response_text,
          reference,
          isSimulated: false,
          status: 'pending',
          gatewayResponseCode: result.response_code,
          gatewayResponseText: 'Success',
        };
      }

      if (result && result.response_code && result.response_code !== '00') {
        const responseCode = String(result.response_code).slice(0, 20);
        let diagnostic = typeof result.response_text === 'string' ? result.response_text : '';
        for (const sensitiveValue of [
          this.masterKey,
          this.privateKey,
          this.token,
          params.customerName || '',
          params.customerEmail || '',
          params.customerPhone || '',
          reference,
        ]) {
          if (sensitiveValue) diagnostic = diagnostic.split(sensitiveValue).join('[redacted]');
        }
        diagnostic = diagnostic.replace(/[\r\n\t]/g, ' ').slice(0, 160);
        console.error(`[PayDunya] Invoice creation rejected (code ${responseCode}): ${diagnostic || 'No provider detail returned.'}`);
        return {
          token: '',
          invoiceUrl: '',
          reference,
          isSimulated: false,
          status: 'failed',
          gatewayResponseCode: result.response_code,
          gatewayResponseText: 'La passerelle a refusé la création de facture.',
          error: `La passerelle PayDunya a refusé la création de facture (code ${String(result.response_code).slice(0, 20)}).`,
        };
      }
    } catch (err) {
      console.error('[PayDunya] Invoice creation request failed:', errorName(err));
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        error: "Impossible de contacter l'API PayDunya. Réessayez dans quelques instants.",
      };
    }

    const unexpectedCode = typeof result?.response_code === 'string' ? result.response_code.slice(0, 20) : 'missing';
    let invoiceHost = 'invalid';
    if (typeof result?.response_text === 'string') {
      try {
        invoiceHost = new URL(result.response_text).hostname;
      } catch {
        invoiceHost = 'not-a-url';
      }
    }
    console.error(`[PayDunya] Unexpected invoice response (code ${unexpectedCode}, token present: ${Boolean(result?.token)}, invoice host: ${invoiceHost}).`);
    return {
      token: '',
      invoiceUrl: '',
      reference,
      isSimulated: false,
      status: 'failed',
      error: 'Réponse inattendue de la passerelle PayDunya.',
    };
  }

  private callPayDunyaApi(endpoint: string, data: string): Promise<PayDunyaApiResponse> {
    return new Promise((resolve, reject) => {
      const baseUrl = this.mode === 'sandbox'
        ? 'https://app.paydunya.com/sandbox-api/v1'
        : 'https://app.paydunya.com/api/v1';

      const url = new URL(baseUrl + endpoint);

      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'PAYDUNYA-MASTER-KEY': this.masterKey,
            'PAYDUNYA-PRIVATE-KEY': this.privateKey,
            'PAYDUNYA-TOKEN': this.token,
            'Content-Length': Buffer.byteLength(data),
          },
          timeout: 12000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) req.destroy(new Error('PayDunya response exceeded size limit'));
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
              else reject(new Error(`PayDunya HTTP ${res.statusCode || 'error'}`));
            } catch {
              reject(new Error('PayDunya returned an invalid JSON response'));
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('PayDunya API request timed out'));
      });

      req.write(data);
      req.end();
    });
  }

  public async confirmInvoice(token: string): Promise<{ status: 'completed' | 'pending' | 'canceled' | 'failed'; data?: any; error?: string }> {
    if (this.configurationError) return { status: 'pending', error: this.configurationError };
    if (!token || !/^[a-zA-Z0-9_-]{1,160}$/.test(token)) {
      return { status: 'pending', error: 'Jeton de facture invalide.' };
    }
    return new Promise((resolve) => {
      const baseUrl = this.mode === 'sandbox'
        ? 'https://app.paydunya.com/sandbox-api/v1'
        : 'https://app.paydunya.com/api/v1';

      const url = new URL(`${baseUrl}/checkout-invoice/confirm/${encodeURIComponent(token)}`);

      const req = https.request(
        url,
        {
          method: 'GET',
          headers: {
            'PAYDUNYA-MASTER-KEY': this.masterKey,
            'PAYDUNYA-PRIVATE-KEY': this.privateKey,
            'PAYDUNYA-TOKEN': this.token,
          },
          timeout: 8000,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.response_code !== '00' || !parsed.invoice || parsed.invoice.token !== token) {
                resolve({ status: 'pending', error: 'La réponse de confirmation PayDunya est incohérente.' });
              } else if (String(parsed.status).toLowerCase() === 'completed') {
                resolve({ status: 'completed', data: parsed });
              } else if (String(parsed.status).toLowerCase() === 'cancelled' || String(parsed.status).toLowerCase() === 'canceled') {
                resolve({ status: 'canceled', data: parsed });
              } else if (String(parsed.status).toLowerCase() === 'failed') {
                resolve({ status: 'failed', data: parsed });
              } else {
                resolve({ status: 'pending', data: parsed });
              }
            } catch {
              resolve({ status: 'pending', error: 'La réponse de confirmation PayDunya est invalide.' });
            }
          });
        }
      );

      req.on('error', (err) => resolve({ status: 'pending', error: errorName(err) }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'pending', error: 'Timeout de validation PayDunya' });
      });
      req.end();
    });
  }
}

function isPayDunyaInvoiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'app.paydunya.com' || url.hostname === 'paydunya.com');
  } catch {
    return false;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}

export const paydunyaService = new PayDunyaService();

// Webhook dispatcher: Sends event to registered merchant endpoints
export async function dispatchMerchantWebhook(
  userId: string,
  applicationId: string,
  event: string,
  data: any
): Promise<void> {
  const db = getDb();

  try {
    const webhooksRes = await db.execute({
      sql: `SELECT * FROM webhooks WHERE user_id = ? AND application_id = ? AND is_active = 1`,
      args: [userId, applicationId],
    });

    for (const row of webhooksRes.rows) {
      const url = String(row.url);
      const secret = String(row.secret);
      const events = String(row.events).split(',');

      if (events.includes(event) || events.includes('*')) {
        const payload = JSON.stringify({
          id: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          event,
          created_at: new Date().toISOString(),
          data,
        });

        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        // Log the webhook attempt in webhook_logs
        const logId = `whl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await db.execute({
          sql: `INSERT INTO webhook_logs (id, webhook_id, user_id, event, payload, status_code, response_body, success, attempts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            logId,
            String(row.id),
            userId,
            event,
            payload,
            200,
            JSON.stringify({ status: 'delivered', signature }),
            1,
            1,
            new Date().toISOString(),
          ],
        });
      }
    }
  } catch (err) {
    console.error('[Webhooks] Dispatch error:', err);
  }
}
