import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserShield,
  faDatabase,
  faLock,
  faEnvelope,
  faClock,
  faScaleBalanced,
  faArrowLeft,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { PichFlowLogo } from '../../components/ui/PichFlowLogo';

interface PrivacyPolicyPageProps {
  onNavigate: (route: string) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onNavigate }) => {
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', color: '#0F172A', paddingBottom: '4rem' }}>
      {/* Header */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '1.25rem 1.5rem', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => onNavigate('/')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label="PichFlow Accueil"
          >
            <PichFlowLogo size="md" />
          </button>
          <button
            onClick={() => onNavigate('/')}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Retour à l'accueil</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '860px', margin: '3rem auto 0 auto', padding: '0 1.5rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '1rem', border: '1px solid #E2E8F0', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#2563EB', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon={faUserShield} style={{ fontSize: '1.25rem' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Protection des Données Personnelles
            </span>
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', lineHeight: 1.25 }}>
            Politique de Confidentialité
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9375rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Dernière mise à jour : 12 octobre 2026. Cette politique décrit avec transparence comment PichFlow collecte, protège et traite les données des marchands et des acheteurs finaux.
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid #F1F5F9', marginBottom: '2rem' }} />

          {/* Section 1 : Données collectées */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FontAwesomeIcon icon={faDatabase} style={{ color: '#2563EB' }} />
              1. Données réellement collectées
            </h2>
            <div style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              <p style={{ marginBottom: '0.75rem' }}>
                PichFlow applique le principe de minimisation des données. Nous collectons exclusivement les données requises pour le fonctionnement comptable et technique :
              </p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
                <li><strong>Comptes marchands :</strong> Nom complet, adresse e-mail professionnelle vérifiée, numéro de téléphone, pays d'établissement et mot de passe chiffré (PBKDF2/SHA-512 avec sel unique).</li>
                <li><strong>Sécurité des sessions :</strong> Adresse IP et identifiant User-Agent enregistrés à des fins exclusives de détection d'intrusions et d'envoi d'e-mails de notification de connexion.</li>
                <li><strong>Transactions d'encaissement :</strong> Nom du client, adresse e-mail, numéro de téléphone mobile money, référence de commande, montant et opérateur de paiement.</li>
                <li><strong>Données sensibles de cartes bancaires :</strong> PichFlow <em>ne stocke jamais</em> les numéros de carte bancaire, dates d'expiration ou codes CVV sur ses serveurs. Les paiements par carte sont directement délégués à nos partenaires certifiés PCI-DSS via des jetons sécurisés (tokenization).</li>
              </ul>
            </div>
          </section>

          {/* Section 2 : Finalités */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#16A34A' }} />
              2. Finalités des Traitements
            </h2>
            <div style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              <p style={{ marginBottom: '0.75rem' }}>Les données recueillies sont strictement utilisées pour :</p>
              <ul style={{ paddingLeft: '1.5rem' }}>
                <li>L'acheminement des flux de paiement vers les opérateurs télécoms (USSD push) et les réseaux bancaires.</li>
                <li>L'envoi des codes de vérification par e-mail lors de l'inscription et la notification de chaque nouvelle connexion.</li>
                <li>La génération des reçus électroniques et la traçabilité comptable dans les portefeuilles marchands.</li>
                <li>La transmission des notifications webhook vers les serveurs des applications partenaires.</li>
                <li>La conformité réglementaire contre la fraude, le blanchiment d'argent et le financement du terrorisme (KYC/AML).</li>
              </ul>
            </div>
          </section>

          {/* Section 3 : Sessions & Cookies */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FontAwesomeIcon icon={faClock} style={{ color: '#2563EB' }} />
              3. Gestion des Sessions et Durée de validité
            </h2>
            <div style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              <p style={{ marginBottom: '0.75rem' }}>
                Pour garantir une utilisation fluide et sécurisée du tableau de bord :
              </p>
              <ul style={{ paddingLeft: '1.5rem' }}>
                <li>Toute session active est protégée par un jeton cryptographique aléatoire d'une validité maximale de <strong>15 heures</strong>.</li>
                <li>La déconnexion volontaire entraîne l'invalidation immédiate et irrévocable du jeton côté serveur dans la base de données.</li>
                <li>Aucun cookie tiers à finalité publicitaire ou de profilage n'est déposé sur les terminaux des visiteurs.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 : Sécurité */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FontAwesomeIcon icon={faLock} style={{ color: '#2563EB' }} />
              4. Mesures de Sécurité
            </h2>
            <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              Toutes les communications entre les navigateurs, l'API PichFlow et les passerelles partenaires s'effectuent via le protocole TLS 1.3 (chiffrement de bout en bout). Les clés d'API secrètes des développeurs sont générées via des générateurs d'entropie cryptographiques (CSPRNG) et masquées dans les interfaces d'administration.
            </p>
          </section>

          {/* Section 5 : Droits et contact */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FontAwesomeIcon icon={faEnvelope} style={{ color: '#2563EB' }} />
              5. Droits des Personnes et Contact DPO
            </h2>
            <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
              Conformément à la réglementation applicable sur la protection des données, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression des informations vous concernant.
            </p>
            <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              Pour exercer ces droits ou pour toute interrogation relative au traitement de vos données, écrivez-nous directement à : <a href="mailto:contactpichflow@gmail.com" style={{ color: '#2563EB', fontWeight: 600 }}>contactpichflow@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};
