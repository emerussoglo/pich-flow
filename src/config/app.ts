export const APP_CONFIG = {
  name: 'PichFlow',
  tagline: 'L’infrastructure de paiement qui fait avancer votre business en Afrique.',
  description:
    'Encaissez par Mobile Money et Cartes Bancaires, automatisez vos réconciliations et pilotez vos flux de paiement depuis une plateforme API unifiée.',
  version: '1.0.0-phase1',
  supportEmail: 'contact@pichflow.com',
  sandboxUrl: 'https://sandbox.pichflow.com',
  apiBaseUrl: 'https://api.pichflow.com/v1',
  docsUrl: '/documentation',
  links: {
    twitter: 'https://x.com/pichflow',
    linkedin: 'https://linkedin.com/company/pichflow',
    github: 'https://github.com/pichflow',
  },
};

export const FAQ_ITEMS = [
  {
    question: "Qu'est-ce que PichFlow ?",
    answer:
      "PichFlow est une infrastructure de paiement et d'encaissement conçue pour permettre aux entrepreneurs, entreprises et développeurs africains d'accepter des paiements (Mobile Money, Cartes) via une API unifiée, des liens de paiement et des checkouts prêts à l'emploi.",
  },
  {
    question: "Comment intégrer PichFlow dans mon site ou application ?",
    answer:
      "L'intégration se fait en quelques lignes de code grâce à notre SDK TypeScript/JavaScript ou directement via notre API REST (POST /v1/payments). Vous pouvez également générer des liens de paiement directement depuis le tableau de bord sans écrire une seule ligne de code.",
  },
  {
    question: "Quels moyens de paiement sont supportés ?",
    answer:
      "PichFlow agrège les principaux réseaux de Mobile Money en Afrique francophone (MTN Mobile Money, Moov Money, Wave, Orange Money, Celtiis Cash) ainsi que les cartes bancaires Visa et Mastercard locales et internationales.",
  },
  {
    question: "Combien coûte l'utilisation de PichFlow ?",
    answer:
      "Notre modèle est 100% à l'usage (Pay-as-you-go). Il n'y a aucun frais d'abonnement mensuel ni frais d'installation. Une commission transparente de 2.5% est appliquée par transaction réussie.",
  },
  {
    question: "Qu'est-ce qu'une 'Application' dans PichFlow ?",
    answer:
      "Une Application est un espace de travail isolé pour un produit ou un projet spécifique (ex. Cardix, E-commerce, SaaS). Chaque application possède ses propres clés API, ses webhooks, son journal de transactions, ses clients et ses wallets distincts.",
  },
  {
    question: "Qu'est-ce qu'une clé API et comment est-elle sécurisée ?",
    answer:
      "Une clé API est un identifiant secret qui autorise vos serveurs à communiquer avec PichFlow. Nous séparons strictement l'environnement Sandbox (clés de test 'pk_test_...', 'sk_test_...') et l'environnement Live ('pk_live_...', 'sk_live_...'). La clé secrète complète n'est affichée qu'une seule fois à sa génération.",
  },
  {
    question: "Comment fonctionnent les webhooks et sont-ils sécurisés ?",
    answer:
      "Dès qu'un paiement ou un retrait change de statut, PichFlow envoie un événement POST en JSON vers votre URL configurée. Chaque webhook est signé cryptographiquement via HMAC SHA-256 avec votre clé secrète, vous permettant de garantir l'authenticité de l'expéditeur.",
  },
  {
    question: "Comment fonctionne un retrait de fonds (Payout) ?",
    answer:
      "Vous pouvez retirer votre solde disponible vers vos comptes Mobile Money ou vos coordonnées bancaires configurées. Les retraits peuvent être déclenchés manuellement depuis le Dashboard ou programmés automatiquement.",
  },
  {
    question: "Pourquoi la vérification KYC est-elle nécessaire ?",
    answer:
      "Pour activer l'environnement Live et effectuer des retraits de fonds réels, les réglementations financières imposent la vérification de l'identité du dirigeant et des documents d'enregistrement de l'entreprise. En mode Sandbox / Test, le KYC n'est pas requis pour tester.",
  },
  {
    question: "Puis-je gérer plusieurs applications avec un seul compte ?",
    answer:
      "Oui. Un compte PichFlow permet de créer et d'administrer plusieurs applications indépendantes au sein de la même interface, avec bascule instantanée entre vos projets.",
  },
];
