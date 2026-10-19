import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCode, faLink, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface SelfRecognitionProps {
  onNavigate?: (route: string) => void;
}

const workflows = [
  {
    icon: faLink,
    title: 'Pour encaisser avec un lien',
    description:
      'Crée un lien en XOF avec un montant fixe ou libre, puis partage son URL publique avec ton client.',
  },
  {
    icon: faShieldHalved,
    title: 'Pour suivre un paiement',
    description:
      'Le client paie sur le checkout hébergé PayDunya. PichFlow conserve le statut en attente jusqu’à confirmation serveur.',
  },
  {
    icon: faCode,
    title: 'Pour intégrer ton application',
    description:
      'Gère des clés API PichFlow rattachées à l’application sélectionnée. Les paiements restent traités par PayDunya.',
  },
];

export const SelfRecognition: React.FC<SelfRecognitionProps> = ({ onNavigate }) => (
  <section id="avantages-section" className="pf-self-recognition-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-section-center-head">
          <div className="pf-badge-pill-blue">
            <span className="pf-pill-blue-dot" />
            <span>Comment utiliser PichFlow</span>
          </div>
          <h2 className="pf-self-title">
            Des outils de paiement <span className="pf-self-title-accent">simples et délimités.</span>
          </h2>
          <p className="pf-self-subtitle">
            PichFlow gère les liens, les applications et le suivi. PayDunya héberge
            le paiement et confirme son statut.
          </p>
        </div>
      </ScrollReveal>

      <div className="pf-comparison-grid">
        {workflows.map((workflow, index) => (
          <ScrollReveal key={workflow.title} delay={120 + index * 100} duration={800} direction="up" distance="24px">
            <article className="pf-compare-card pf-compare-after">
              <div className="pf-compare-badge pf-badge-after">
                <FontAwesomeIcon icon={workflow.icon} />
                <span>{workflow.title}</span>
              </div>
              <p className="pf-compare-verdict-desc">{workflow.description}</p>
            </article>
          </ScrollReveal>
        ))}
      </div>

      <div className="pf-compare-footer pf-footer-after">
        <button
          type="button"
          onClick={() => onNavigate?.('/register')}
          className="pf-saspay-btn-primary"
        >
          <span>Créer un compte</span>
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  </section>
);
