import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Official SasPay API Client
 * Base URL: https://api.saspay.me/api/v1
 * Specification: OpenAPI 3.1 (https://docs.saspay.me/api-reference/openapi.json)
 */
export interface SasPayConfig {
  apiKeyTest?: string;
  apiKeyLive?: string;
  webhookSecret?: string;
  baseUrl?: string;
}

export interface SasPayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface SasPayCustomerInfo {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface SasPayCheckoutSessionParams {
  amount: string; // decimal string, e.g. "5000.00"
  currency: string; // e.g. "XOF"
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  country?: string; // ISO 2, e.g. "BJ"
  description?: string;
  return_url?: string;
  metadata?: Record<string, any>;
  fee_charge_mode?: 'ADD_ON' | 'DEDUCTED';
  expires_at?: string;
}

export interface SasPaySoftpayParams {
  amount: string; // decimal string, e.g. "2500.00"
  currency: string; // e.g. "XOF"
  country: string; // ISO 2, e.g. "BJ"
  network: string; // e.g. "mtn_bj"
  customer: SasPayCustomerInfo;
  description?: string;
  fee_charge_mode?: 'ADD_ON' | 'DEDUCTED';
  preferred_gateway?: string;
  metadata?: Record<string, any>;
  merchant?: string;
  otp?: string; // Prepayment OTP if required by network
}

export interface SasPayPayoutParams {
  amount: string; // decimal string, e.g. "10000.00"
  currency: string; // e.g. "XAF"
  country: string; // ISO 2, e.g. "CM"
  customer: {
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  method: string; // network code, e.g. "mtn_cm"
  recipient: {
    msisdn: string; // e.g. "677889900"
  };
  description?: string;
  fee_charge_mode?: 'ADD_ON' | 'DEDUCTED';
  metadata?: Record<string, any>;
  preferred_gateway?: string;
  merchant?: string;
}

export interface SasPayWalletTransferParams {
  from_country: string; // ISO 2, e.g. "BJ"
  to_country: string; // ISO 2, e.g. "CM"
  from_amount: string; // decimal string, e.g. "50000.00"
  merchant?: string;
}

export interface SasPayPaymentLinkParams {
  title: string;
  description?: string;
  amount?: string | null;
  is_fixed_amount?: boolean;
  currency?: string;
  country?: string;
  usage_limit?: number | null;
  require_phone?: boolean;
  redirect_url?: string;
}

/**
 * Ensures amounts are formatted strictly as decimal strings with 2 decimals (e.g. "2500.00")
 */
export function formatDecimalAmount(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) {
    return '0.00';
  }
  return num.toFixed(2);
}

/**
 * Cleanly splits full customer name into first and last name
 */
export function splitCustomerName(fullName?: string): { first_name: string; last_name: string } {
  const trimmed = (fullName || 'Client').trim();
  const parts = trimmed.split(/\s+/);
  const first_name = parts[0] || 'Client';
  const last_name = parts.slice(1).join(' ') || 'Client';
  return { first_name, last_name };
}

/**
 * Maps payment method & country to official SasPay network code
 */
export function resolveSasPayNetwork(method?: string, country?: string): string {
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

export class SasPayService {
  private baseUrl: string;
  private apiKeyTest: string;
  private apiKeyLive: string;
  private webhookSecret: string;

  constructor(config?: SasPayConfig) {
    this.baseUrl = (config?.baseUrl || process.env.SASPAY_BASE_URL || 'https://api.saspay.me/api/v1').replace(/\/$/, '');
    this.apiKeyTest = (config?.apiKeyTest || process.env.SASPAY_API_KEY_TEST || process.env.SASPAY_API_KEY || '').trim();
    this.apiKeyLive = (config?.apiKeyLive || process.env.SASPAY_API_KEY_LIVE || '').trim();
    this.webhookSecret = (config?.webhookSecret || process.env.SASPAY_WEBHOOK_SECRET || '').trim();
  }

  /**
   * Returns active API key based on environment mode
   */
  public getApiKey(environment: 'sandbox' | 'live' = 'sandbox'): string {
    if (environment === 'live') {
      return this.apiKeyLive || this.apiKeyTest;
    }
    return this.apiKeyTest || this.apiKeyLive;
  }

  /**
   * Checks whether an API key is configured for the requested environment
   */
  public isConfigured(environment: 'sandbox' | 'live' = 'sandbox'): boolean {
    const key = this.getApiKey(environment);
    return Boolean(key && key.length > 5);
  }

  /**
   * Generic request executor adhering strictly to SasPay REST standards
   */
  private async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: any;
      environment?: 'sandbox' | 'live';
      idempotencyKey?: string;
      customApiKey?: string;
    } = {}
  ): Promise<SasPayResponse<T>> {
    const method = options.method || 'GET';
    const env = options.environment || 'sandbox';
    const apiKey = options.customApiKey || this.getApiKey(env);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'PichFlow-Gateway/2.0',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (options.body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (options.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const res = await fetch(url, fetchOptions);
      const statusCode = res.status;

      let data: any = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        let errorMsg = `Erreur SasPay HTTP ${statusCode}`;
        if (data && typeof data === 'object') {
          if (typeof data.message === 'string') {
            errorMsg = data.message;
          } else if (typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (typeof data.error === 'string') {
            errorMsg = data.error;
          } else if (data.error && typeof data.error.message === 'string') {
            errorMsg = data.error.message;
          } else {
            // Validation errors: { field: ["message"] }
            const entries = Object.entries(data);
            if (entries.length > 0) {
              const [field, val] = entries[0];
              const msg = Array.isArray(val) ? val.join(', ') : String(val);
              errorMsg = `${field}: ${msg}`;
            }
          }
        }

        return {
          success: false,
          error: errorMsg,
          data,
          statusCode,
        };
      }

      return {
        success: true,
        data,
        statusCode,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Erreur réseau SasPay: ${err.message}`,
        statusCode: 500,
      };
    }
  }

  // =========================================================================
  // 1. CHECKOUT SESSIONS
  // =========================================================================

  /**
   * POST /checkout-sessions/
   * NOTE: As per SasPay specification, Idempotency-Key is NOT supported on this endpoint.
   */
  public async createCheckoutSession(
    params: SasPayCheckoutSessionParams,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount),
    };
    return this.request('/checkout-sessions/', {
      method: 'POST',
      body: payload,
      environment,
    });
  }

  /**
   * GET /checkout-sessions/
   */
  public async listCheckoutSessions(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/checkout-sessions/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /checkout-sessions/{id}/
   */
  public async getCheckoutSession(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /checkout-sessions/{id}/status/
   */
  public async getCheckoutSessionStatus(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/status/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * POST /checkout-sessions/{id}/cancel/
   */
  public async cancelCheckoutSession(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/cancel/`, {
      method: 'POST',
      environment,
    });
  }

  // =========================================================================
  // 2. PAIEMENT DIRECT (SOFTPAY) & OTP
  // =========================================================================

  /**
   * POST /payments/softpay/
   * Initiates direct push payment to mobile money or card. Supports Idempotency-Key.
   */
  public async initiateSoftpay(
    params: SasPaySoftpayParams,
    idempotencyKey?: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount),
    };
    return this.request('/payments/softpay/', {
      method: 'POST',
      body: payload,
      idempotencyKey,
      environment,
    });
  }

  /**
   * GET /payments/{payment_id}/verify/
   * Check verified payment status directly from SasPay
   */
  public async verifyPayment(
    paymentId: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/verify/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * POST /payments/{payment_id}/confirm-otp/
   */
  public async confirmOtp(
    paymentId: string,
    otp: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/confirm-otp/`, {
      method: 'POST',
      body: { otp },
      environment,
    });
  }

  /**
   * POST /payments/{payment_id}/retry/
   * Replay a failed payment attempt. Supports Idempotency-Key.
   */
  public async retryPayment(
    paymentId: string,
    idempotencyKey?: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/retry/`, {
      method: 'POST',
      idempotencyKey,
      environment,
    });
  }

  // =========================================================================
  // 3. RETRAITS (PAYOUTS)
  // =========================================================================

  /**
   * POST /payouts/initialize/
   * Requires IP Whitelisting on merchant account. Supports Idempotency-Key.
   */
  public async initializePayout(
    params: SasPayPayoutParams,
    idempotencyKey?: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount),
    };
    return this.request('/payouts/initialize/', {
      method: 'POST',
      body: payload,
      idempotencyKey,
      environment,
    });
  }

  /**
   * GET /payouts/{payout_id}/verify/
   */
  public async verifyPayout(
    payoutId: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payouts/${encodeURIComponent(payoutId)}/verify/`, {
      method: 'GET',
      environment,
    });
  }

  // =========================================================================
  // 4. TRANSACTIONS & RELEVES
  // =========================================================================

  /**
   * GET /transactions/
   */
  public async listTransactions(
    params: { page?: number; page_size?: number; status?: string; type?: string; from_date?: string; to_date?: string } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/transactions/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /transactions/{id}/
   */
  public async getTransaction(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/transactions/${encodeURIComponent(id)}/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /transactions/export/ (CSV export)
   */
  public async exportTransactionsCsv(
    params: Record<string, any> = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/transactions/export/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /transactions/{id}/invoice/ (PDF invoice)
   */
  public async getTransactionInvoice(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/transactions/${encodeURIComponent(id)}/invoice/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /transaction-attempts/
   */
  public async listTransactionAttempts(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/transaction-attempts/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /transaction-status-logs/
   */
  public async listTransactionStatusLogs(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/transaction-status-logs/${query}`, {
      method: 'GET',
      environment,
    });
  }

  // =========================================================================
  // 5. LIENS DE PAIEMENT
  // =========================================================================

  /**
   * POST /payment-links/
   */
  public async createPaymentLink(
    params: SasPayPaymentLinkParams,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      amount: params.amount !== undefined && params.amount !== null ? formatDecimalAmount(params.amount) : undefined,
    };
    return this.request('/payment-links/', {
      method: 'POST',
      body: payload,
      environment,
    });
  }

  /**
   * GET /payment-links/
   */
  public async listPaymentLinks(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/payment-links/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /payment-links/{id}/
   */
  public async getPaymentLink(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * PATCH /payment-links/{id}/
   */
  public async updatePaymentLink(
    id: string,
    params: Partial<SasPayPaymentLinkParams>,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      amount: params.amount !== undefined && params.amount !== null ? formatDecimalAmount(params.amount) : undefined,
    };
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: 'PATCH',
      body: payload,
      environment,
    });
  }

  /**
   * DELETE /payment-links/{id}/
   */
  public async deletePaymentLink(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: 'DELETE',
      environment,
    });
  }

  /**
   * GET /payment-links/{id}/transactions/
   */
  public async getPaymentLinkTransactions(
    id: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request(`/payment-links/${encodeURIComponent(id)}/transactions/`, {
      method: 'GET',
      environment,
    });
  }

  // =========================================================================
  // 6. WALLETS, BALANCES & TRANSFERTS
  // =========================================================================

  /**
   * GET /merchant-balances/
   */
  public async getMerchantBalances(
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request('/merchant-balances/', {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /exchange-rates/
   */
  public async getExchangeRates(
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    return this.request('/exchange-rates/', {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /wallet-transfers/
   */
  public async listWalletTransfers(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/wallet-transfers/${query}`, {
      method: 'GET',
      environment,
    });
  }

  /**
   * POST /wallet-transfers/
   * Supports Idempotency-Key.
   */
  public async createWalletTransfer(
    params: SasPayWalletTransferParams,
    idempotencyKey?: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const payload = {
      ...params,
      from_amount: formatDecimalAmount(params.from_amount),
    };
    return this.request('/wallet-transfers/', {
      method: 'POST',
      body: payload,
      idempotencyKey,
      environment,
    });
  }

  // =========================================================================
  // 7. PAYS, RÉSEAUX ET TARIFS DYNAMIQUES
  // =========================================================================

  /**
   * GET /countries/
   */
  public async getCountries(environment: 'sandbox' | 'live' = 'sandbox'): Promise<SasPayResponse> {
    return this.request('/countries/', {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /networks/
   */
  public async getNetworks(environment: 'sandbox' | 'live' = 'sandbox'): Promise<SasPayResponse> {
    return this.request('/networks/', {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /pricing/my-rates/
   */
  public async getMyRates(environment: 'sandbox' | 'live' = 'sandbox'): Promise<SasPayResponse> {
    return this.request('/pricing/my-rates/', {
      method: 'GET',
      environment,
    });
  }

  // =========================================================================
  // 8. WEBHOOK CONSULTATION (Dashboard-managed points)
  // =========================================================================

  /**
   * GET /merchant-webhooks/
   */
  public async listWebhooks(environment: 'sandbox' | 'live' = 'sandbox'): Promise<SasPayResponse> {
    return this.request('/merchant-webhooks/', {
      method: 'GET',
      environment,
    });
  }

  /**
   * GET /webhook-logs/
   */
  public async listWebhookLogs(
    params: { page?: number; page_size?: number } = {},
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<SasPayResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request(`/webhook-logs/${query}`, {
      method: 'GET',
      environment,
    });
  }

  // =========================================================================
  // 9. SIGNATURE VERIFICATION (HMAC SHA-256)
  // =========================================================================

  /**
   * Verifies incoming webhook HMAC signature according to official SasPay spec:
   * 1. Check timestamp age against tolerance (300 seconds / 5 minutes)
   * 2. Compute HMAC SHA-256 on `${timestampHeader}.${rawBody}`
   * 3. Timing-safe comparison against signatureHeader
   */
  public verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    timestampHeader: string,
    secret?: string
  ): { valid: boolean; isValid: boolean; reason?: string; error?: string } {
    const signingSecret = secret || this.webhookSecret;
    if (!signingSecret) {
      const msg = 'Secret de signature non configuré (SASPAY_WEBHOOK_SECRET)';
      return { valid: false, isValid: false, reason: msg, error: msg };
    }

    if (!signatureHeader || !timestampHeader) {
      const msg = 'Headers de webhook manquants (X-Webhook-Signature ou X-Webhook-Timestamp)';
      return { valid: false, isValid: false, reason: msg, error: msg };
    }

    // 1. Age check (5 minutes tolerance)
    const TOLERANCE_SECONDS = 300;
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestampHeader, 10);

    if (isNaN(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) {
      const msg = `Horodatage de webhook expiré ou invalide (delta > ${TOLERANCE_SECONDS}s)`;
      return { valid: false, isValid: false, reason: msg, error: msg };
    }

    // 2. HMAC calculation on RAW BODY
    const expected = crypto
      .createHmac('sha256', signingSecret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex')
      .toLowerCase();

    const cleanSignature = signatureHeader.trim().toLowerCase();

    // 3. Timing safe comparison
    try {
      const a = Buffer.from(cleanSignature, 'utf8');
      const b = Buffer.from(expected, 'utf8');

      if (a.length !== b.length) {
        const msg = 'Longueur de signature incorrecte';
        return { valid: false, isValid: false, reason: msg, error: msg };
      }

      const match = crypto.timingSafeEqual(a, b);
      if (!match) {
        const msg = 'Signature HMAC invalide';
        return { valid: false, isValid: false, reason: msg, error: msg };
      }

      return { valid: true, isValid: true };
    } catch (err: any) {
      const msg = `Erreur comparaison signature: ${err.message}`;
      return { valid: false, isValid: false, reason: msg, error: msg };
    }
  }
}

export const sasPayService = new SasPayService();
