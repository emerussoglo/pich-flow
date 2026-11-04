import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { DOCUMENTED_PAYMENT_CHANNELS, SUPPORTED_PAYMENT_CURRENCIES } from '../config/countries';
import { getDb } from './db';
import { getAppBaseUrl, getPayDunyaCallbackUrl } from './urls';

dotenv.config();

export interface CreateInvoiceParams {
  amount: number;
  currency?: string;
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
  success?: boolean;
  message?: string;
  url?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SoftPayCustomer {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  otp?: string;
}

export interface SoftPayResult {
  success: boolean;
  message: string;
  redirectUrl?: string;
  transactionId?: string;
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
    const minimumAmount = SUPPORTED_PAYMENT_CURRENCIES.find(
      (currency) => currency.code === (params.currency || 'XOF').toUpperCase(),
    )?.minimumAmount ?? 1;
    if (!Number.isSafeInteger(params.amount) || params.amount < minimumAmount) {
      return {
        token: '',
        invoiceUrl: '',
        reference,
        isSimulated: false,
        status: 'failed',
        error: `Le montant minimum accepté par PayDunya est de ${minimumAmount} ${params.currency || 'XOF'}.`,
      };
    }

    const payload = JSON.stringify({
      invoice: {
        total_amount: params.amount,
        ...(params.currency ? { currency: params.currency } : {}),
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

  public async initiateSoftPay(
    paymentToken: string,
    methodId: string,
    customer: SoftPayCustomer,
  ): Promise<SoftPayResult> {
    if (this.configurationError) {
      return { success: false, message: this.configurationError };
    }
    if (!paymentToken || !/^[a-zA-Z0-9_-]{1,160}$/.test(paymentToken)) {
      return { success: false, message: 'Jeton PayDunya invalide.' };
    }

    const request = buildSoftPayRequest(methodId, paymentToken, customer);
    if (!request) {
      return { success: false, message: 'Ce moyen de paiement n’est pas pris en charge.' };
    }

    try {
      const response = await this.callPayDunyaApi(request.endpoint, JSON.stringify(request.payload));
      const message = typeof response.message === 'string'
        ? response.message.slice(0, 400)
        : 'Demande de paiement transmise à PayDunya.';
      if (response.success !== true) return { success: false, message };

      const redirectUrl = typeof response.url === 'string' ? response.url : undefined;
      if (redirectUrl && !isAllowedSoftPayRedirectUrl(redirectUrl)) {
        return { success: false, message: 'PayDunya a renvoyé une URL de paiement non sécurisée.' };
      }
      const transactionData = response.data;
      const transactionId = transactionData && typeof transactionData === 'object'
        ? String(transactionData.TransactionID || transactionData.transactionid || '')
        : '';
      return {
        success: true,
        message,
        ...(redirectUrl ? { redirectUrl } : {}),
        ...(transactionId ? { transactionId } : {}),
      };
    } catch (error) {
      console.error('[PayDunya] SoftPay request failed:', errorName(error));
      return { success: false, message: 'Impossible de contacter PayDunya. Réessayez dans quelques instants.' };
    }
  }

  public async confirmWizallPayment(
    authorizationCode: string,
    phone: string,
    transactionId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (this.configurationError) return { success: false, message: this.configurationError };
    if (!/^[0-9]{4,8}$/.test(authorizationCode) || !/^[0-9]{6,20}$/.test(transactionId)) {
      return { success: false, message: 'Le code de confirmation est invalide.' };
    }
    try {
      const response = await this.callPayDunyaApi(
        '/softpay/wizall-money-senegal/confirm',
        JSON.stringify({
          authorization_code: authorizationCode,
          phone_number: phone,
          transaction_id: transactionId,
        }),
      );
      return {
        success: response.success === true,
        message: typeof response.message === 'string'
          ? response.message.slice(0, 400)
          : 'PayDunya n’a pas confirmé le code Wizall.',
      };
    } catch (error) {
      console.error('[PayDunya] Wizall confirmation failed:', errorName(error));
      return { success: false, message: 'Impossible de confirmer le code Wizall auprès de PayDunya.' };
    }
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

function buildSoftPayRequest(
  methodId: string,
  paymentToken: string,
  customer: SoftPayCustomer,
): { endpoint: string; payload: Record<string, string> } | null {
  const isDocumentedMethod = DOCUMENTED_PAYMENT_CHANNELS.some(
    (method) => method.id === methodId && method.type === 'mobile_money',
  );
  if (!isDocumentedMethod) return null;

  const { fullName, email, phone, address = '', otp = '' } = customer;
  switch (methodId) {
    case 'orange-money-senegal':
      return { endpoint: '/softpay/new-orange-money-senegal', payload: { customer_name: fullName, customer_email: email, phone_number: phone, invoice_token: paymentToken } };
    case 'free-money-senegal':
      return { endpoint: '/softpay/free-money-senegal', payload: { customer_name: fullName, customer_email: email, phone_number: phone, payment_token: paymentToken } };
    case 'expresso-sn':
      return { endpoint: '/softpay/expresso-senegal', payload: { expresso_sn_fullName: fullName, expresso_sn_email: email, expresso_sn_phone: phone, payment_token: paymentToken } };
    case 'wave-senegal':
      return { endpoint: '/softpay/wave-senegal', payload: { wave_senegal_fullName: fullName, wave_senegal_email: email, wave_senegal_phone: phone, wave_senegal_payment_token: paymentToken } };
    case 'wizall-senegal':
      return { endpoint: '/softpay/wizall-money-senegal', payload: { customer_name: fullName, customer_email: email, phone_number: phone, invoice_token: paymentToken } };
    case 'orange-money-ci':
      return { endpoint: '/softpay/orange-money-ci', payload: { orange_money_ci_customer_fullname: fullName, orange_money_ci_email: email, orange_money_ci_phone_number: phone, orange_money_ci_otp: otp, payment_token: paymentToken } };
    case 'mtn-ci':
      return { endpoint: '/softpay/mtn-ci', payload: { mtn_ci_customer_fullname: fullName, mtn_ci_email: email, mtn_ci_phone_number: phone, mtn_ci_wallet_provider: 'MTNCI', payment_token: paymentToken } };
    case 'moov-ci':
      return { endpoint: '/softpay/moov-ci', payload: { moov_ci_customer_fullname: fullName, moov_ci_email: email, moov_ci_phone_number: phone, payment_token: paymentToken } };
    case 'wave-ci':
      return { endpoint: '/softpay/wave-ci', payload: { wave_ci_fullName: fullName, wave_ci_email: email, wave_ci_phone: phone, wave_ci_payment_token: paymentToken } };
    case 'orange-money-burkina':
      return { endpoint: '/softpay/orange-money-burkina', payload: { name_bf: fullName, email_bf: email, phone_bf: phone, otp_code: otp, payment_token: paymentToken } };
    case 'moov-burkina-faso':
      return { endpoint: '/softpay/moov-burkina', payload: { moov_burkina_faso_fullName: fullName, moov_burkina_faso_email: email, moov_burkina_faso_phone_number: phone, moov_burkina_faso_payment_token: paymentToken } };
    case 'moov-benin':
      return { endpoint: '/softpay/moov-benin', payload: { moov_benin_customer_fullname: fullName, moov_benin_email: email, moov_benin_phone_number: phone, payment_token: paymentToken } };
    case 'mtn-benin':
      return { endpoint: '/softpay/mtn-benin', payload: { mtn_benin_customer_fullname: fullName, mtn_benin_email: email, mtn_benin_phone_number: phone, mtn_benin_wallet_provider: 'MTNBENIN', payment_token: paymentToken } };
    case 't-money-togo':
      return { endpoint: '/softpay/t-money-togo', payload: { name_t_money: fullName, email_t_money: email, phone_t_money: phone, payment_token: paymentToken } };
    case 'moov-togo':
      return { endpoint: '/softpay/moov-togo', payload: { moov_togo_customer_fullname: fullName, moov_togo_email: email, moov_togo_customer_address: address, moov_togo_phone_number: phone, payment_token: paymentToken } };
    case 'orange-money-mali':
      return { endpoint: '/softpay/orange-money-mali', payload: { orange_money_mali_customer_fullname: fullName, orange_money_mali_email: email, orange_money_mali_phone_number: phone, orange_money_mali_customer_address: address, payment_token: paymentToken } };
    case 'moov-ml':
      return { endpoint: '/softpay/moov-mali', payload: { moov_ml_customer_fullname: fullName, moov_ml_email: email, moov_ml_phone_number: phone, moov_ml_customer_address: address, payment_token: paymentToken } };
    case 'mtn-cameroun':
      return { endpoint: '/softpay/mtn-cameroun', payload: { mtn_cameroun_customer_fullname: fullName, mtn_cameroun_email: email, mtn_cameroun_phone_number: phone, mtn_cameroun_wallet_provider: 'MTNCAMEROUN', payment_token: paymentToken } };
    case 'djamo-sn':
      return { endpoint: '/softpay/djamo', payload: { djamo_fullName: fullName, djamo_email: email, djamo_phone: phone, code_country: 'sn', djamo_payment_token: paymentToken } };
    case 'djamo-ci':
      return { endpoint: '/softpay/djamo', payload: { djamo_fullName: fullName, djamo_email: email, djamo_phone: phone, code_country: 'ci', djamo_payment_token: paymentToken } };
    case 'celtiis-cash':
      return { endpoint: '/softpay/celtiis-cash', payload: { celtiis_cash_customer_fullname: fullName, celtiis_cash_customer_email: email, celtiis_cash_phone_number: phone, payment_token: paymentToken } };
    default:
      return null;
  }
}

function isAllowedSoftPayRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && [
      'app.paydunya.com',
      'paydunya.com',
      'www.paydunya.com',
      'pay.wave.com',
      'p.djamo.com',
      'sugu.orange-sonatel.com',
      'orangemoneysn.page.link',
      'authentication.cardinalcommerce.com',
    ].includes(url.hostname);
  } catch {
    return false;
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
