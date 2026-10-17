import { Application, Transaction, Wallet, PaymentLink, Customer, Withdrawal, PayoutMethod, ApiKey, WebhookEndpoint, CheckoutSession } from '../types';

const TOKEN_KEY = 'pf_auth_token';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

function getHttpErrorMessage(status: number, isHtml: boolean): string {
  if (status === 404 && isHtml) {
    return 'Le service de connexion est introuvable. L’API n’est peut-être pas déployée correctement.';
  }
  if (status === 404) {
    return 'Le service demandé est introuvable (HTTP 404).';
  }
  if (status >= 500) {
    return `Le serveur rencontre un problème (HTTP ${status}). Réessayez plus tard.`;
  }
  return `La requête a échoué (HTTP ${status}). Vérifiez les informations saisies et réessayez.`;
}

export async function parseApiResponse(response: Response, endpoint: string): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = /\b(?:application|text)\/(?:[\w.+-]+\+)?json\b/i.test(contentType);
  const body = await response.text();
  const isHtml = /text\/html/i.test(contentType) || /^\s*<!doctype html|^\s*<html\b/i.test(body);

  if (!response.ok) {
    let message = '';
    if (isJson && body.trim()) {
      try {
        const data = JSON.parse(body);
        if (data && typeof data.error === 'string' && data.error.trim()) {
          message = data.error;
        }
      } catch (error) {
        console.warn('[API] Invalid JSON error response:', {
          endpoint,
          status: response.status,
          contentType,
          error,
        });
      }
    }
    throw new ApiResponseError(message || getHttpErrorMessage(response.status, isHtml), response.status);
  }

  if (!isJson) {
    console.error('[API] Expected a JSON response:', {
      endpoint,
      status: response.status,
      contentType,
      empty: !body.trim(),
    });
    throw new Error('Le serveur a renvoyé une réponse inattendue. Réessayez plus tard.');
  }

  if (!body.trim()) {
    console.error('[API] Empty JSON response:', { endpoint, status: response.status });
    throw new Error('Le serveur a renvoyé une réponse vide. Réessayez plus tard.');
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch (error) {
    console.error('[API] Malformed JSON response:', {
      endpoint,
      status: response.status,
      contentType,
      error,
    });
    throw new Error('La réponse du serveur est invalide. Réessayez plus tard.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('La réponse du serveur est invalide. Réessayez plus tard.');
  }

  if ('success' in data && data.success === false) {
    const message = 'error' in data && typeof data.error === 'string' ? data.error : '';
    throw new Error(message || 'La requête a échoué. Réessayez plus tard.');
  }

  return data;
}

export const apiClient = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },

  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`/api${endpoint}`, {
        ...options,
        credentials: options.credentials ?? 'same-origin',
        headers,
      });
    } catch (error) {
      console.error('[API] Request failed:', { endpoint, error });
      throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.');
    }

    return (await parseApiResponse(response, endpoint)) as T;
  },

  // Auth
  auth: {
    async login(email: string, password: string) {
      const res = await apiClient.request<{ success: boolean; token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      apiClient.setToken(res.token);
      return res;
    },

    async register(data: { email: string; password: string; fullName: string; country: string; phone?: string }) {
      const res = await apiClient.request<{
        success: boolean;
        requireVerification: boolean;
        email: string;
        message: string;
        devCode?: string;
        emailSent?: boolean;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },

    async verifyCode(email: string, code: string) {
      const res = await apiClient.request<{ success: boolean; token: string; user: any }>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (res.token) apiClient.setToken(res.token);
      return res;
    },

    async resendCode(email: string) {
      return apiClient.request<{ success: boolean; message: string; devCode?: string; emailSent?: boolean }>('/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async forgotPassword(email: string) {
      return apiClient.request<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword(email: string, code: string, newPassword: string) {
      return apiClient.request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
    },

    async testLoginAlert() {
      return apiClient.request<{ success: boolean; message: string }>('/auth/test-login-alert', {
        method: 'POST',
      });
    },

    async me() {
      return apiClient.request<{ success: boolean; user: any }>('/auth/me');
    },

    async logout() {
      try {
        return await apiClient.request<{ success: boolean; message: string }>('/auth/logout', {
          method: 'POST',
        });
      } finally {
        apiClient.clearToken();
      }
    },

    async changePassword(currentPassword: string, newPassword: string) {
      return apiClient.request<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    async toggle2FA(enable: boolean) {
      return apiClient.request<{ success: boolean; enabled: boolean }>('/auth/toggle-2fa', {
        method: 'POST',
        body: JSON.stringify({ enable }),
      });
    },
  },

  // Applications
  apps: {
    async getAll(): Promise<Application[]> {
      const res = await apiClient.request<{ success: boolean; applications: Application[] }>('/apps');
      return res.applications;
    },

    async create(data: Partial<Application>): Promise<Application> {
      const res = await apiClient.request<{ success: boolean; application: Application }>('/apps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.application;
    },

    async update(id: string, data: Partial<Application>) {
      return apiClient.request<{ success: boolean; message: string }>(`/apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string) {
      return apiClient.request<{ success: boolean; message: string; archived?: boolean }>(`/apps/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Wallets
  wallets: {
    async getAll(applicationId: string): Promise<Wallet[]> {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      const res = await apiClient.request<{ success: boolean; wallets: Wallet[] }>(`/wallets${query}`);
      return res.wallets;
    },

    async create(data: { applicationId: string; countryCode: string; currency: string; symbol?: string }): Promise<Wallet> {
      const res = await apiClient.request<{ success: boolean; wallet: Wallet }>('/wallets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.wallet;
    },

    async transfer(data: { applicationId: string; fromWalletId: string; toWalletId: string; amount: number }): Promise<{ success: boolean; message: string; reference: string }> {
      return apiClient.request<{ success: boolean; message: string; reference: string }>('/wallets/transfer', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Transactions
  transactions: {
    async getAll(applicationId?: string): Promise<Transaction[]> {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const res = await apiClient.request<{ success: boolean; transactions: Transaction[] }>(`/transactions${query}`);
      return res.transactions;
    },
  },

  // Payment Links
  paymentLinks: {
    async getAll(applicationId?: string): Promise<PaymentLink[]> {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const res = await apiClient.request<{ success: boolean; paymentLinks: PaymentLink[] }>(`/payment-links${query}`);
      return res.paymentLinks;
    },

    async create(data: Partial<PaymentLink>): Promise<PaymentLink> {
      const res = await apiClient.request<{ success: boolean; paymentLink: PaymentLink }>('/payment-links', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.paymentLink;
    },

    async update(id: string, data: Partial<PaymentLink>) {
      return apiClient.request<{ success: boolean; message: string }>(`/payment-links/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string) {
      return apiClient.request<{ success: boolean; message: string }>(`/payment-links/${id}`, {
        method: 'DELETE',
      });
    },

    async getBySlug(slug: string) {
      return apiClient.request<{ success: boolean; paymentLink: any }>(`/payment-links/slug/${slug}`);
    },
  },

  // Checkout Sessions
  checkoutSessions: {
    async getAll(applicationId?: string): Promise<CheckoutSession[]> {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const res = await apiClient.request<{ success: boolean; checkoutSessions: CheckoutSession[] }>(`/checkout-sessions${query}`);
      return res.checkoutSessions;
    },
  },

  // Customers
  customers: {
    async getAll(applicationId: string): Promise<Customer[]> {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      const res = await apiClient.request<{ success: boolean; customers: Customer[] }>(`/customers${query}`);
      return res.customers;
    },

    async create(data: Partial<Customer>): Promise<Customer> {
      const res = await apiClient.request<{ success: boolean; customer: Customer }>('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.customer;
    },

    async update(id: string, applicationId: string, data: Partial<Customer>): Promise<void> {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      await apiClient.request<{ success: boolean; message: string }>(`/customers/${id}${query}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string, applicationId: string): Promise<void> {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      await apiClient.request<{ success: boolean; message: string }>(`/customers/${id}${query}`, {
        method: 'DELETE',
      });
    },
  },

  // Withdrawals
  withdrawals: {
    async getAll(applicationId: string): Promise<Withdrawal[]> {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      const res = await apiClient.request<{ success: boolean; withdrawals: Withdrawal[] }>(`/withdrawals${query}`);
      return res.withdrawals;
    },

    async create(data: Partial<Withdrawal> & { applicationId: string }): Promise<Withdrawal> {
      const res = await apiClient.request<{ success: boolean; withdrawal: Withdrawal }>('/withdrawals', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.withdrawal;
    },
  },

  // Payout Methods
  payoutMethods: {
    async getAll(): Promise<PayoutMethod[]> {
      const res = await apiClient.request<{ success: boolean; payoutMethods: PayoutMethod[] }>('/payout-methods');
      return res.payoutMethods;
    },

    async create(data: Partial<PayoutMethod>): Promise<PayoutMethod> {
      const res = await apiClient.request<{ success: boolean; payoutMethod: PayoutMethod }>('/payout-methods', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.payoutMethod;
    },

    async delete(id: string): Promise<void> {
      await apiClient.request<{ success: boolean; message: string }>(`/payout-methods/${id}`, {
        method: 'DELETE',
      });
    },

    async setDefault(id: string): Promise<void> {
      await apiClient.request<{ success: boolean; message: string }>(`/payout-methods/${id}/default`, {
        method: 'PUT',
      });
    },
  },

  // Developer Center (Single Secret Key & Webhooks)
  developer: {
    async getKeys(applicationId?: string): Promise<ApiKey[]> {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const res = await apiClient.request<{ success: boolean; apiKeys: ApiKey[] }>(`/developer/keys${query}`);
      return res.apiKeys;
    },

    async generateKey(data: { name: string; environment?: 'sandbox' | 'live'; scope?: 'payin' | 'payout' | 'both'; applicationId?: string }): Promise<{ apiKey: ApiKey }> {
      const res = await apiClient.request<{ success: boolean; apiKey: ApiKey }>('/developer/keys', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },

    async revokeKey(id: string, applicationId: string) {
      const query = `?applicationId=${encodeURIComponent(applicationId)}`;
      return apiClient.request<{ success: boolean; message: string }>(`/developer/keys/${id}${query}`, {
        method: 'DELETE',
      });
    },

    async getWebhooks(applicationId?: string): Promise<WebhookEndpoint[]> {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      const res = await apiClient.request<{ success: boolean; webhooks: WebhookEndpoint[] }>(`/developer/webhooks${query}`);
      return res.webhooks;
    },

    async addWebhook(data: { url: string; description: string; applicationId?: string }): Promise<WebhookEndpoint> {
      const res = await apiClient.request<{ success: boolean; webhook: WebhookEndpoint }>('/developer/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.webhook;
    },

    async deleteWebhook(id: string) {
      return apiClient.request<{ success: boolean; message: string }>(`/developer/webhooks/${id}`, {
        method: 'DELETE',
      });
    },

    async updateWebhook(id: string, data: any) {
      return apiClient.request<{ success: boolean; message: string }>(`/developer/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async getWebhookLogs(applicationId?: string) {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
      return apiClient.request<{ success: boolean; logs: any[] }>(`/developer/webhooks/logs${query}`);
    },

    async testWebhook(id: string) {
      return apiClient.request<{ success: boolean; message: string; delivery: any }>(`/developer/webhooks/${id}/test`, {
        method: 'POST',
      });
    },
  },

  // Settings & KYC
  settings: {
    async getKyc() {
      return apiClient.request<{ success: boolean; kyc: any; documents?: any[] }>('/settings/kyc');
    },

    async saveKyc(data: any) {
      return apiClient.request<{ success: boolean; message: string }>('/settings/kyc', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async uploadDoc(documentType: string, fileName: string, fileData: string) {
      return apiClient.request<{ success: boolean; documentId: string; fileUrl: string; fileName: string }>('/settings/kyc/upload', {
        method: 'POST',
        body: JSON.stringify({ documentType, fileName, fileData }),
      });
    },

    async testApproveKyc() {
      return apiClient.request<{ success: boolean; message: string; status: string }>('/settings/kyc/test-approve', {
        method: 'POST',
      });
    },
  },

  // Checkout
  checkout: {
    async initiate(data: any) {
      return apiClient.request<{ success: boolean; reference: string; token: string; invoiceUrl: string; isSimulated: boolean }>('/checkout/initiate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async confirm(data: { reference: string; phone?: string; operator?: string; otp?: string }) {
      return apiClient.request<{ success: boolean; reference: string; status: string; message: string }>('/checkout/confirm', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getStatus(reference: string) {
      return apiClient.request<{ success: boolean; reference: string; status: string; amount: number; currency: string }>(`/checkout/status/${reference}`);
    },
  },
};
