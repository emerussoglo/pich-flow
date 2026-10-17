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
  methods: PaymentMethodOption[];
  note: string;
}

export const SUPPORTED_COUNTRIES: CountryCoverage[] = [
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    currency: 'XOF',
    currencySymbol: 'FCFA',
    methods: [],
    note: 'Le checkout est configuré en XOF avec validation du numéro béninois. PayDunya affiche les moyens disponibles selon la configuration réelle du compte.',
  },
];
