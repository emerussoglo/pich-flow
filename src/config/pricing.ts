export interface PricingTier {
  id: string;
  name: string;
  description: string;
  percentFee: number;
  fixedFee: number;
  fixedFeeCurrency: string;
  payoutPercentFee: number;
  payoutFixedFee: number;
  features: string[];
}

export const PRICING_CONFIG = {
  currency: 'XOF',
  model: 'Pay as you go (Paiement à la transaction)',
  subtitle: 'Aucun frais mensuel fixe. Vous ne payez que lorsque vous encaissez.',
  tiers: [
    {
      id: 'standard',
      name: 'Standard Entreprise & SaaS',
      description: 'Pour toutes les startups, indépendants et entreprises en phase de croissance.',
      percentFee: 2.5, // 2.5% par transaction
      fixedFee: 0,
      fixedFeeCurrency: 'XOF',
      payoutPercentFee: 1.0,
      payoutFixedFee: 150,
      badge: 'Recommandé',
      features: [
        'Environnement Sandbox & Live illimité',
        'Mobile Money (MTN, Moov, Celtiis, Wave)',
        'Cartes Bancaires locales & internationales',
        'API RESTful & Webhooks signés HMAC',
        'Checkout hébergé & Liens de paiement',
        'Multi-applications indépendantes',
        'Retraits programmés vers Mobile Money & Banque',
        'Support réactif par chat & documentation',
      ],
    },
    {
      id: 'custom',
      name: 'Grands Comptes / Volume',
      description: 'Pour les entreprises traitant plus de 25 000 000 XOF de volume mensuel.',
      percentFee: 1.8,
      fixedFee: 0,
      fixedFeeCurrency: 'XOF',
      payoutPercentFee: 0.8,
      payoutFixedFee: 100,
      badge: 'Sur mesure',
      features: [
        'Tarification dégressive personnalisée',
        'Gestionnaire de compte dédié 24/7',
        'SLA 99.9% garanti avec monitoring proactif',
        'Rapprochement comptable automatisé',
        'Intégration d’infrastructure sur mesure',
        'Support multi-devises prioritaire',
      ],
    },
  ],
  feeEstimator: {
    minAmount: 1000,
    maxAmount: 2000000,
    defaultAmount: 25000,
    calculate(amount: number) {
      const platformFee = Math.round(amount * 0.015); // 1.5% PichFlow
      const providerFee = Math.round(amount * 0.01); // 1.0% Provider Mobile Money / Carte
      const totalFee = platformFee + providerFee; // 2.5%
      const netAmount = amount - totalFee;
      return {
        amount,
        platformFee,
        providerFee,
        totalFee,
        netAmount,
      };
    },
  },
};
