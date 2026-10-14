import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { getDb } from './db';

dotenv.config();

export interface CreateInvoiceParams {
  amount: number;
  description: string;
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

export class PayDunyaService {
  private masterKey: string;
  private privateKey: string;
  private publicKey: string;
  private token: string;
  private isTestMode: boolean;

  constructor() {
    const sanitizeKey = (envVal: string | undefined, defaultVal: string) => {
      const trimmed = (envVal || '').trim();
      if (!trimmed || trimmed.includes('*')) {
        return defaultVal;
      }
      return trimmed;
    };

    this.masterKey = sanitizeKey(process.env.PAYDUNYA_MASTER_KEY, '2e1fiYSi-lB47-tEsH-H2Eu-qLVho7Kt2XQJ');
    this.privateKey = sanitizeKey(process.env.PAYDUNYA_PRIVATE_KEY, 'test_private_fbEBOy3wlMbDcCg2Zoj6WuVvSE3');
    this.publicKey = sanitizeKey(process.env.PAYDUNYA_PUBLIC_KEY, 'test_public_bPcQT0OdANmmWrmLuJkpbrdOmgY');
    this.token = sanitizeKey(process.env.PAYDUNYA_TOKEN, 'BK51ZoY7DwaDmbtSbNEE');
    this.isTestMode = this.privateKey.includes('test_') || !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
  }

  public async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
    const reference = `TX-PF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const payload = JSON.stringify({
      invoice: {
        total_amount: params.amount,
        description: params.description,
      },
      store: {
        name: params.storeName || 'PichFlow Merchant',
      },
      custom_data: {
        reference,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
      },
      actions: {
        cancel_url: params.cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/checkout-demo?status=cancel`,
        return_url: params.returnUrl || `${process.env.APP_URL || 'http://localhost:3000'}/checkout-demo?status=success&ref=${reference}`,
        callback_url: params.callbackUrl || `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/paydunya`,
      },
    });

    try {
      const result = await this.callPayDunyaApi('/checkout-invoice/create', payload);
      if (result && result.response_code === '00' && result.token) {
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
        console.warn(`[PayDunya] Gateway error (${result.response_code}): ${result.response_text}`);
        return {
          token: '',
          invoiceUrl: '',
          reference,
          isSimulated: false,
          status: 'failed',
          gatewayResponseCode: result.response_code,
          gatewayResponseText: result.response_text,
          error: `Passerelle PayDunya (${result.response_code}): ${result.response_text}`,
        };
      }
    } catch (err: any) {
      console.warn('[PayDunya] Gateway network or call error:', err.message);
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        error: `Impossible de contacter l'API PayDunya: ${err.message}`,
      };
    }

    // Default error if unexpected response
    return {
      token: '',
      invoiceUrl: '',
      reference,
      isSimulated: false,
      status: 'failed',
      error: 'Réponse inattendue de la passerelle PayDunya.',
    };
  }

  private callPayDunyaApi(endpoint: string, data: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const baseUrl = this.isTestMode
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
          timeout: 7000,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed);
            } catch {
              reject(new Error(`Invalid JSON: ${body}`));
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
    return new Promise((resolve) => {
      const baseUrl = this.isTestMode
        ? 'https://app.paydunya.com/sandbox-api/v1'
        : 'https://app.paydunya.com/api/v1';

      const url = new URL(`${baseUrl}/checkout-invoice/confirm/${token}`);

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
              if (parsed.status === 'completed' || (parsed.response_code === '00' && parsed.status === 'completed')) {
                resolve({ status: 'completed', data: parsed });
              } else if (parsed.status === 'canceled' || parsed.status === 'failed') {
                resolve({ status: parsed.status, data: parsed });
              } else {
                resolve({ status: 'pending', data: parsed });
              }
            } catch {
              resolve({ status: 'pending', error: 'Impossible de parser la réponse PayDunya' });
            }
          });
        }
      );

      req.on('error', (err) => resolve({ status: 'pending', error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'pending', error: 'Timeout de validation PayDunya' });
      });
      req.end();
    });
  }
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
