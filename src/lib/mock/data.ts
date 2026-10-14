import {
  Application,
  Transaction,
  Wallet,
  PaymentLink,
  Customer,
  ApiKey,
  WebhookEndpoint,
  Withdrawal,
  LedgerEntry,
} from '../../types';

// Zero mock data policy: All collections start strictly empty.
// Real data is populated exclusively from database & authenticated user session.
export const MOCK_APPLICATIONS: Application[] = [];
export const MOCK_WALLETS: Wallet[] = [];
export const MOCK_TRANSACTIONS: Transaction[] = [];
export const MOCK_PAYMENT_LINKS: PaymentLink[] = [];
export const MOCK_CUSTOMERS: Customer[] = [];
export const MOCK_API_KEYS: ApiKey[] = [];
export const MOCK_WEBHOOKS: WebhookEndpoint[] = [];
export const MOCK_WITHDRAWALS: Withdrawal[] = [];
export const MOCK_LEDGER_ENTRIES: LedgerEntry[] = [];
