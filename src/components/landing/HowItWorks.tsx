import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCheck, faLock, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface HowItWorksProps {
  onNavigate?: (route: string) => void;
}

const steps = [
  {
    title: 'Crée ton compte et ton application',
    description: 'Accède au dashboard et sélectionne l’application qui possédera tes ressources.',
  },
  {
    title: 'Crée un lien de paiement',
    description: 'Configure un lien en XOF pour le Bénin, puis partage son URL publique avec ton client.',
  },
  {
    title: 'Laisse PayDunya traiter le paiement',
    description: 'Le client paie sur la page hébergée PayDunya. PichFlow vérifie le statut côté serveur.',
  },
];

export const HowItWorks: React.FC<HowItWorksProps> = ({ onNavigate }) => (
  <section id="demarrage-rapide" className="pf-how-it-works-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-section-center-head">
          <div className="pf-badge-pill-purple">
            <span>Fonctionnement</span>
          </div>
          <h2 className="pf-heading-purple-accent">
            Du lien au statut vérifié, <span className="pf-italic-accent">sans détour.</span>
          </h2>
        </div>
      </ScrollReveal>

      <div className="pf-how-it-works-grid">
        <div className="pf-steps-list-col">
          {steps.map((step, index) => (
            <div className="pf-step-row-item" key={step.title}>
              <div className="pf-step-number-circle">{index + 1}</div>
              <div className="pf-step-row-content">
                <h3 className="pf-step-row-title">{step.title}</h3>
                <p className="pf-step-row-desc">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pf-signup-card-col">
          <div className="pf-signup-mock-card">
            <div className="pf-mock-header">
              <div className="pf-mock-title">À savoir avant de commencer</div>
            </div>
            <div className="pf-mock-form">
              <p className="pf-mock-field">
                Une facture a été créée en Sandbox au Bénin. Aucun paiement n’a
                été effectué ; la préparation du mode production dépend de ton
                compte PayDunya.
              </p>
              <button
                type="button"
                className="pf-mock-submit-btn"
                onClick={() => onNavigate?.('/register')}
              >
                Créer un compte <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const SecuritySection: React.FC = () => (
  <section id="securite-section" className="pf-security-dark-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-section-center-head">
          <div className="pf-badge-pill-security">
            <span>Sécurité du parcours</span>
          </div>
          <h2 className="pf-heading-security-white">
            Les responsabilités de paiement <span className="pf-italic-security-accent">sont séparées.</span>
          </h2>
        </div>
      </ScrollReveal>

      <div className="pf-security-cards-grid">
        <ScrollReveal delay={100} duration={750} direction="up" distance="20px">
          <div className="pf-security-card">
            <div className="pf-security-icon-circle">
              <FontAwesomeIcon icon={faShieldHalved} />
            </div>
            <h3 className="pf-security-card-title">Checkout PayDunya hébergé</h3>
            <p className="pf-security-card-desc">
              Les informations sensibles de carte ou de Mobile Money sont saisies sur le parcours PayDunya, pas dans PichFlow.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={200} duration={750} direction="up" distance="20px">
          <div className="pf-security-card">
            <div className="pf-security-icon-circle">
              <FontAwesomeIcon icon={faLock} />
            </div>
            <h3 className="pf-security-card-title">Données séparées par application</h3>
            <p className="pf-security-card-desc">
              Les opérations privées vérifient l’application et les droits associés côté serveur.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={300} duration={750} direction="up" distance="20px">
          <div className="pf-security-card">
            <div className="pf-security-icon-circle">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <h3 className="pf-security-card-title">Confirmation serveur</h3>
            <p className="pf-security-card-desc">
              Un retour navigateur ne confirme pas un paiement ; le statut doit être vérifié auprès de PayDunya.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);
