import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from './payments';

export type PaymentMethodType = 'mobile_money' | 'card';
export type PaymentMethodInput = 'orange-ci-otp' | 'orange-bf-otp' | 'customer-address' | 'wizall-authorization';

export interface PaymentMethodOption {
  id: string;
  name: string;
  provider: 'PayDunya';
  type: PaymentMethodType;
  phoneLength?: number;
  phoneHint?: string;
  input?: PaymentMethodInput;
  instructions?: string;
  redirectToProvider?: boolean;
}

export interface CountryCoverage {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  status: 'available_sandbox' | 'live_ready' | 'planned';
  statusLabel: string;
  operators: string[];
  methods: PaymentMethodOption[];
  note: string;
}

export const DOCUMENTED_PAYMENT_CHANNELS: ReadonlyArray<
  PaymentMethodOption & { country: string; currency: string }
> = [
  { id: 'card', country: 'INT', currency: '*', name: 'Carte bancaire', provider: 'PayDunya', type: 'card', redirectToProvider: true },
  { id: 'orange-money-senegal', country: 'SN', currency: 'XOF', name: 'Orange Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9, redirectToProvider: true },
  { id: 'free-money-senegal', country: 'SN', currency: 'XOF', name: 'Free Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9 },
  { id: 'expresso-sn', country: 'SN', currency: 'XOF', name: 'Expresso', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9 },
  { id: 'wave-senegal', country: 'SN', currency: 'XOF', name: 'Wave', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9, redirectToProvider: true },
  { id: 'wizall-senegal', country: 'SN', currency: 'XOF', name: 'Wizall', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9, input: 'wizall-authorization' },
  { id: 'djamo-sn', country: 'SN', currency: 'XOF', name: 'Djamo', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9, redirectToProvider: true },
  { id: 'orange-money-ci', country: 'CI', currency: 'XOF', name: 'Orange Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 10, input: 'orange-ci-otp', instructions: 'Composez #144*82# puis choisissez l’option 2 pour obtenir votre code de paiement.' },
  { id: 'mtn-ci', country: 'CI', currency: 'XOF', name: 'MTN', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9 },
  { id: 'moov-ci', country: 'CI', currency: 'XOF', name: 'Moov', provider: 'PayDunya', type: 'mobile_money', phoneLength: 10 },
  { id: 'wave-ci', country: 'CI', currency: 'XOF', name: 'Wave', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9, redirectToProvider: true },
  { id: 'djamo-ci', country: 'CI', currency: 'XOF', name: 'Djamo', provider: 'PayDunya', type: 'mobile_money', phoneLength: 10, redirectToProvider: true },
  { id: 'orange-money-burkina', country: 'BF', currency: 'XOF', name: 'Orange Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8, input: 'orange-bf-otp' },
  { id: 'moov-burkina-faso', country: 'BF', currency: 'XOF', name: 'Moov', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8 },
  { id: 'mtn-benin', country: 'BJ', currency: 'XOF', name: 'MTN Mobile Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8 },
  { id: 'moov-benin', country: 'BJ', currency: 'XOF', name: 'Moov Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 10 },
  { id: 'celtiis-cash', country: 'BJ', currency: 'XOF', name: 'CELTIIS CASH', provider: 'PayDunya', type: 'mobile_money', phoneLength: 10 },
  { id: 't-money-togo', country: 'TG', currency: 'XOF', name: 'T-Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8 },
  { id: 'moov-togo', country: 'TG', currency: 'XOF', name: 'Moov Togo', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8, input: 'customer-address' },
  { id: 'orange-money-mali', country: 'ML', currency: 'XOF', name: 'Orange Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8, input: 'customer-address' },
  { id: 'moov-ml', country: 'ML', currency: 'XOF', name: 'Moov', provider: 'PayDunya', type: 'mobile_money', phoneLength: 8, input: 'customer-address' },
  { id: 'mtn-cameroun', country: 'CM', currency: 'XAF', name: 'MTN Mobile Money', provider: 'PayDunya', type: 'mobile_money', phoneLength: 9 },
];

const countryDefinitions: Omit<CountryCoverage, 'methods' | 'operators'>[] = [
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'available_sandbox',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    dialCode: '+221',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'CI',
    name: 'Côte d’Ivoire',
    flag: '🇨🇮',
    dialCode: '+225',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    dialCode: '+226',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    dialCode: '+223',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canaux SoftPay documentés; activation du compte à vérifier',
    note: 'Les moyens proposés sont ceux documentés par PayDunya pour ce pays.',
  },
  {
    code: 'CM',
    name: 'Cameroun',
    flag: '🇨🇲',
    dialCode: '+237',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    status: 'planned',
    statusLabel: 'Canal SoftPay documenté en XAF; configuration du compte à vérifier',
    note: 'Le montant est libellé en XAF; vérifiez la devise configurée sur le compte PayDunya.',
  },
  {
    code: 'INT',
    name: 'International',
    flag: '🌍',
    dialCode: '',
    currency: 'XOF',
    currencySymbol: 'XOF',
    status: 'planned',
    statusLabel: 'Carte via le checkout hébergé PayDunya',
    note: 'Le paiement par carte est délégué à la page sécurisée hébergée par PayDunya.',
  },
];

export const SUPPORTED_COUNTRIES: CountryCoverage[] = countryDefinitions.map((country) => {
  const methods = DOCUMENTED_PAYMENT_CHANNELS.filter(
    (method) => method.country === country.code && (method.currency === country.currency || method.currency === '*'),
  );
  return {
    ...country,
    operators: methods.map((method) => method.name),
    methods,
  };
});

export const CHECKOUT_COUNTRIES = SUPPORTED_COUNTRIES;

export const SUPPORTED_PAYMENT_CURRENCIES = [
  {
    code: 'XOF',
    label: 'XOF (FCFA)',
    minimumAmount: PAYDUNYA_MINIMUM_AMOUNT_XOF,
  },
  {
    code: 'XAF',
    label: 'XAF (FCFA)',
    minimumAmount: PAYDUNYA_MINIMUM_AMOUNT_XOF,
  },
] as const;

function normalizeCountrySearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function filterCountriesBySearch(
  countries: readonly CountryCoverage[],
  query: string,
): CountryCoverage[] {
  const search = normalizeCountrySearch(query);
  if (!search) return [...countries];

  return countries.filter((country) =>
    normalizeCountrySearch(
      `${country.name} ${country.code} ${country.dialCode} ${country.currency}`,
    ).includes(search),
  );
}

export function getPaymentMethodsForCountry(countryCode: string): PaymentMethodOption[] {
  return DOCUMENTED_PAYMENT_CHANNELS.filter((method) => method.country === countryCode.toUpperCase());
}

export function getPaymentMethodsForCountryAndCurrency(
  countryCode: string,
  currency: string,
): PaymentMethodOption[] {
  const country = countryCode.toUpperCase();
  const code = currency.toUpperCase();
  return DOCUMENTED_PAYMENT_CHANNELS.filter(
    (method) => method.country === country && (method.currency === code || method.currency === '*'),
  );
}

export function countrySupportsCurrency(countryCode: string, currency: string): boolean {
  const country = countryCode.toUpperCase();
  const code = currency.toUpperCase();
  return countryDefinitions.some(
    (supportedCountry) => supportedCountry.code === country &&
      (supportedCountry.currency === code || (country === 'INT' && code === 'XAF')),
  );
}

export function normalizePaymentPhone(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  const isInternational = /^\s*(?:\+|00)/.test(phone);
  const dialCode = countryDefinitions.find((country) => country.code === countryCode.toUpperCase())?.dialCode;
  const dialDigits = dialCode?.replace(/\D/g, '') || '';
  if (isInternational && dialDigits && digits.startsWith(dialDigits)) {
    return digits.slice(dialDigits.length);
  }
  return digits;
}

export function isSupportedPaymentCurrency(currency: string): boolean {
  return SUPPORTED_PAYMENT_CURRENCIES.some((supported) => supported.code === currency.toUpperCase());
}
