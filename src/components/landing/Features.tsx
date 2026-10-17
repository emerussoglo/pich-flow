import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faCode,
  faLink,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface FeaturesProps {
  onNavigate?: (route: string) => void;
}

const features = [
  {
    icon: faLink,
    title: 'Liens de paiement',
    description:
      'Crée et retrouve les liens de paiement associés à l’application sélectionnée dans ton espace.',
    preview: 'Un lien public est généré après enregistrement.',
  },
  {
    icon: faShieldHalved,
    title: 'Checkout hébergé',
    description:
      'Le client est redirigé vers PayDunya pour choisir parmi les moyens activés sur le compte marchand.',
    preview: 'Aucune donnée de carte n’est collectée par PichFlow.',
  },
  {
    icon: faChartLine,
    title: 'Suivi des transactions',
    description:
      'Consulte les transactions et leur état, séparément pour chaque application.',
    preview: 'Le retour du navigateur ne suffit pas à confirmer un paiement.',
  },
  {
    icon: faCode,
    title: 'Accès développeur',
    description:
      'Crée des clés API PichFlow limitées à l’application concernée et gère leur révocation.',
    preview: 'Les frais PayDunya ne sont pas estimés sans données confirmées.',
  },
];

export const Features: React.FC<FeaturesProps> = () => (
  <section id="capacites-section" className="pf-capacites-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-section-center-head">
          <div className="pf-badge-pill-blue">
            <span className="pf-pill-blue-dot" />
            <span>Fonctionnalités</span>
          </div>
          <h2 className="pf-heading-blue-accent">
            Les outils essentiels, <span className="pf-italic-accent">sans promesses fictives.</span>
          </h2>
        </div>
      </ScrollReveal>

      <div className="pf-capacites-grid">
        {features.map((feature, index) => (
          <ScrollReveal
            key={feature.title}
            delay={100 + index * 100}
            duration={800}
            direction="up"
            distance="24px"
          >
            <article className="pf-capacite-card">
              <div className="pf-capacite-icon-box">
                <FontAwesomeIcon icon={feature.icon} />
              </div>
              <h3 className="pf-capacite-title">{feature.title}</h3>
              <p className="pf-capacite-desc">{feature.description}</p>
              <div className="pf-capacite-mini-ui">
                <p className="pf-mini-ui-label">{feature.preview}</p>
              </div>
            </article>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);
