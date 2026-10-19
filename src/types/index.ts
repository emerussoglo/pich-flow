export type EnvironmentMode = 'test' | 'live';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'expired' | 'completed' | 'paid';

export type WithdrawalStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'completed';

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected' | 'unsubmitted';

export type ApiKeyEnvironment = 'sandbox' | 'live';

export type ApiKeyScope = 'payin' | 'payout' | 'both';

export type WebhookEventType =
  | 'payment.created'
  | 'payment.pending'
  | 'payment.success'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'withdrawal.created'
  | 'withdrawal.success'
  | 'withdrawal.failed';

export type LedgerEntryType =
  | 'PAYMENT'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'FEE'
  | 'ADJUSTMENT'
  | 'TRANSFER';

export interface Application {
  id: string;
  name: string;
  slug: string;
  category: string;
  website: string;
  environment: EnvironmentMode;
  createdAt: string;
  currency: string;
}

export interface Transaction {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  provider: string; // 'MTN MoMo' | 'Moov Money' | 'Celtiis Cash' | 'Wave' | 'Carte'
  amount: number;
  providerFee: number | null;
  platformFee: number;
  customerFee: number;
  netAmount: number | null;
  feesConfirmed?: boolean;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  description: string;
  paymentMethod: string;
  type?: string;
  paymentLinkId?: string;
  fee?: number;
}

export interface PaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string;
  amount: number | null; // null if open amount
  isFixedAmount: boolean;
  currency: string;
  country: string;
  status: 'active' | 'archived' | 'expired';
  usageCount: number;
  usageLimit: number | null;
  requirePhone: boolean;
  createdAt: string;
  expiresAt?: string | null;
  paymentUrl?: string;
  redirectUrl?: string;
  applicationId?: string;
}

export interface CheckoutSession {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  paymentMethod: string;
  paydunyaUrl?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  paymentCount: number;
  totalSpent: number;
  currency: string;
  lastTransactionAt: string;
  applicationId?: string;
  lastTransaction?: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    paymentLinkTitle?: string;
  };
}

export interface Wallet {
  id: string;
  currency: string;
  symbol: string;
  balance: number;
  pendingBalance: number;
  reservedBalance: number;
  countryCode: string;
  isDefault: boolean;
}

export interface LedgerEntry {
  id: string;
  applicationId: string;
  walletId: string;
  type: LedgerEntryType;
  reference: string;
  amount: number;
  currency: string;
  providerFee: number;
  platformFee: number;
  customerFee: number;
  netAmount: number;
  createdAt: string;
  description: string;
}

export interface Withdrawal {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  methodType: 'mobile_money' | 'bank_transfer';
  recipientName: string;
  recipientPhoneOrIban: string;
  operatorOrBank: string;
  country: string;
  status: WithdrawalStatus;
  createdAt: string;
  processedAt?: string;
}

export interface PayoutMethod {
  id: string;
  type: 'mobile_money' | 'bank_transfer';
  label: string;
  operatorOrBank: string;
  recipientName: string;
  recipientPhoneOrIban: string;
  accountNumber?: string;
  iban?: string;
  swiftBic?: string;
  bankCode?: string;
  branchCode?: string;
  country: string;
  currency: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  environment: ApiKeyEnvironment;
  prefix: string;
  secretMasked: string;
  secretKey?: string;
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
  lastDeliveryStatus?: 'success' | 'failed';
}

export interface WebhookLog {
  id: string;
  endpointId: string;
  event: WebhookEventType;
  status: 'success' | 'failed';
  httpStatus: number;
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: string;
}
