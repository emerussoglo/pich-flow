import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from './payments';

export interface PaymentMethodOption {
  id: string;
  name: string;
  provider: string;
  type: 'mobile_money' | 'card' | 'bank_transfer' | 'crypto';
  indicativeFee: string;
  isAvailable: boolean;
  fixedFee?: number;
  fixedFeeCurrency?: string;
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

export const DOCUMENTED_PAYMENT_CHANNELS = [
  { id: 'card', country: 'ALL', currency: '', name: 'Carte bancaire', type: 'card' },
  { id: 'orange-money-senegal', country: 'SN', currency: 'XOF', name: 'Orange Money Sénégal', type: 'mobile_money' },
  { id: 'wave-senegal', country: 'SN', currency: 'XOF', name: 'Wave Sénégal', type: 'mobile_money' },
  { id: 'free-money-senegal', country: 'SN', currency: 'XOF', name: 'Free Money Sénégal', type: 'mobile_money' },
  { id: 'expresso-sn', country: 'SN', currency: 'XOF', name: 'Expresso SN', type: 'mobile_money' },
  { id: 'wizall-senegal', country: 'SN', currency: 'XOF', name: 'Wizall Sénégal', type: 'mobile_money' },
  { id: 'mtn-benin', country: 'BJ', currency: 'XOF', name: 'MTN Bénin', type: 'mobile_money' },
  { id: 'moov-benin', country: 'BJ', currency: 'XOF', name: 'Moov Bénin', type: 'mobile_money' },
  { id: 'orange-money-ci', country: 'CI', currency: 'XOF', name: 'Orange Money Côte d’Ivoire', type: 'mobile_money' },
  { id: 'wave-ci', country: 'CI', currency: 'XOF', name: 'Wave Côte d’Ivoire', type: 'mobile_money' },
  { id: 'mtn-ci', country: 'CI', currency: 'XOF', name: 'MTN Côte d’Ivoire', type: 'mobile_money' },
  { id: 'moov-ci', country: 'CI', currency: 'XOF', name: 'Moov Côte d’Ivoire', type: 'mobile_money' },
  { id: 'djamo-ci', country: 'CI', currency: 'XOF', name: 'Djamo Côte d’Ivoire', type: 'mobile_money' },
  { id: 't-money-togo', country: 'TG', currency: 'XOF', name: 'TMoney Togo', type: 'mobile_money' },
  { id: 'moov-togo', country: 'TG', currency: 'XOF', name: 'Moov Togo', type: 'mobile_money' },
  { id: 'orange-money-mali', country: 'ML', currency: 'XOF', name: 'Orange Money Mali', type: 'mobile_money' },
  { id: 'moov-ml', country: 'ML', currency: 'XOF', name: 'Moov Mali', type: 'mobile_money' },
  { id: 'orange-money-burkina', country: 'BF', currency: 'XOF', name: 'Orange Money Burkina Faso', type: 'mobile_money' },
  { id: 'moov-burkina-faso', country: 'BF', currency: 'XOF', name: 'Moov Burkina Faso', type: 'mobile_money' },
  { id: 'mtn-cameroun', country: 'CM', currency: 'XAF', name: 'MTN Cameroun', type: 'mobile_money' },
  { id: 'djamo-sn', country: 'SN', currency: 'XOF', name: 'Djamo Sénégal', type: 'mobile_money' },
  { id: 'celtiis-cash', country: 'BJ', currency: 'XOF', name: 'Celtiis Cash Bénin', type: 'mobile_money' },
] as const;

const unavailableMethods = (countryCode: string): PaymentMethodOption[] =>
  DOCUMENTED_PAYMENT_CHANNELS
    .filter((method) => method.country === countryCode || method.country === 'ALL')
    .map((method) => ({
      id: method.id,
      name: method.name,
      provider: 'PayDunya',
      type: method.type,
      indicativeFee: 'Non vérifié',
      isAvailable: false,
    }));

const plannedCountry = (
  code: string,
  name: string,
  flag: string,
  dialCode: string,
  currency: string,
): CountryCoverage => ({
  code,
  name,
  flag,
  dialCode,
  currency,
  currencySymbol: currency === 'XAF' ? 'FCFA XAF' : 'FCFA XOF',
  status: 'planned',
  statusLabel: 'Canaux documentés, activation du compte non vérifiée',
  operators: [],
  methods: unavailableMethods(code),
  note: 'PayDunya documente ces canaux, mais leur activation et leur disponibilité dans le flux PichFlow ne sont pas confirmées.',
});

export const SUPPORTED_COUNTRIES: CountryCoverage[] = [
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    status: 'available_sandbox',
    statusLabel: 'Facture Sandbox PayDunya testée; paiement non effectué',
    operators: [],
    methods: [],
    note: 'Les moyens réellement activés sont présentés par le checkout hébergé PayDunya; PichFlow ne présume aucun canal.',
  },
  plannedCountry('SN', 'Sénégal', '🇸🇳', '+221', 'XOF'),
  plannedCountry('CI', 'Côte d’Ivoire', '🇨🇮', '+225', 'XOF'),
  plannedCountry('TG', 'Togo', '🇹🇬', '+228', 'XOF'),
  plannedCountry('ML', 'Mali', '🇲🇱', '+223', 'XOF'),
  plannedCountry('BF', 'Burkina Faso', '🇧🇫', '+226', 'XOF'),
  plannedCountry('CM', 'Cameroun', '🇨🇲', '+237', 'XAF'),
];

export const CHECKOUT_COUNTRIES = SUPPORTED_COUNTRIES.filter(
  (country) => country.status !== 'planned',
);

export const SUPPORTED_PAYMENT_CURRENCIES = [
  {
    code: 'XOF',
    label: 'XOF (FCFA)',
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

export function isSupportedPaymentCurrency(currency: string): boolean {
  return SUPPORTED_PAYMENT_CURRENCIES.some((supported) => supported.code === currency.toUpperCase());
}
