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
];
