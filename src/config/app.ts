export const APP_CONFIG = {
  name: 'PichFlow',
  tagline: 'L’infrastructure de paiement qui fait avancer votre business en Afrique.',
  description:
    'Créez des liens de paiement et des sessions de checkout PayDunya, avec des données isolées par application.',
  version: '1.0.0-phase1',
  supportEmail: 'contact@pichflow.com',
  apiBaseUrl: 'https://pichflow.vercel.app/api/v1',
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
      "PichFlow permet aux marchands de gérer plusieurs applications, de créer des liens de paiement et d'initier un checkout PayDunya. La configuration de paiement actuelle est limitée à XOF et au Bénin.",
  },
  {
    question: "Comment intégrer PichFlow dans mon site ou application ?",
    answer:
      "Depuis votre serveur, utilisez l'API PitchFlow versionnée pour créer un lien de paiement ou une session checkout. Les routes actuellement disponibles sont documentées dans le centre développeur; aucun SDK public n'est annoncé.",
  },
  {
    question: "Quels moyens de paiement sont supportés ?",
    answer:
      "Le client poursuit son paiement dans la page sécurisée PayDunya. Les moyens affichés dépendent de la disponibilité réelle de votre compte PayDunya; PichFlow ne promet pas de réseau ou de moyen particulier.",
  },
  {
    question: "Combien coûte l'utilisation de PichFlow ?",
    answer:
      "Les frais PayDunya dépendent de la configuration et du contrat applicables. PichFlow n'ajoute pas de majoration client arbitraire et cette interface ne publie pas de tarif non vérifié.",
  },
  {
    question: "Qu'est-ce qu'une 'Application' dans PichFlow ?",
    answer:
      "Une application est le périmètre de données d'un produit marchand. Les liens, paiements confirmés, wallets et clés API sont filtrés côté serveur par l'application et son propriétaire.",
  },
  {
    question: "Qu'est-ce qu'une clé API et comment est-elle sécurisée ?",
    answer:
      "Une clé API PitchFlow pf_test_ ou pf_live_ autorise les opérations liées à une seule application. Son hash est stocké côté serveur; la valeur secrète complète n'est affichée qu'à la création et doit rester sur votre serveur.",
  },
  {
    question: "Comment fonctionnent les webhooks et sont-ils sécurisés ?",
    answer:
      "Après confirmation d'un paiement, un webhook marchand peut envoyer l'événement payment.succeeded signé par HMAC-SHA-256. Le système journalise une tentative mais ne réessaie pas automatiquement les livraisons échouées.",
  },
  {
    question: "Comment fonctionne un retrait de fonds (Payout) ?",
    answer:
      "Les retraits ne sont pas activés par l'intégration actuelle. Le solde issu des paiements confirmés est suivi comme solde en attente et n'est pas présenté comme disponible chez PayDunya.",
  },
  {
    question: "Pourquoi la vérification KYC est-elle nécessaire ?",
    answer:
      "Les exigences KYC et d'activation dépendent de PayDunya et du statut du compte marchand. Vérifiez-les auprès du prestataire avant toute activation en production.",
  },
  {
    question: "Puis-je gérer plusieurs applications avec un seul compte ?",
    answer:
      "Oui. Un compte PichFlow permet de créer et d'administrer plusieurs applications indépendantes au sein de la même interface, avec bascule instantanée entre vos projets.",
  },
];
