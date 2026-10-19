import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCode, faKey, faLink } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface DevelopersProps {
  onNavigate?: (route: string) => void;
}

const developerTools = [
  {
    icon: faLink,
    title: 'Créer un lien',
    description: 'Génère un lien de paiement public depuis le dashboard et rattache-le à une application.',
  },
  {
    icon: faKey,
    title: 'Gérer des clés API',
    description: 'Les clés PichFlow sont limitées à leur application ; leur secret complet est affiché uniquement à la création.',
  },
  {
    icon: faCode,
    title: 'Intégrer les endpoints',
    description: 'Consulte la documentation disponible et vérifie les réponses de l’API dans ton environnement.',
  },
];

export const Developers: React.FC<DevelopersProps> = ({ onNavigate }) => (
  <section className="pf-founders-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-founders-header">
          <div className="pf-badge-pill-purple">
            <span>Pour les développeurs</span>
          </div>
          <h2 className="pf-heading-purple-accent">
            Intègre PichFlow <span className="pf-italic-accent">à ton rythme.</span>
          </h2>
          <p className="pf-founders-subhead">
            Commence avec les ressources actuellement disponibles : applications,
            liens de paiement, clés API et suivi des transactions.
          </p>
        </div>
      </ScrollReveal>

      <div className="pf-founders-grid">
        <div className="pf-founders-list">
          {developerTools.map((tool, index) => (
            <ScrollReveal key={tool.title} delay={index * 120} duration={750} direction="up" distance="20px">
              <div className="pf-founders-item">
                <div className="pf-founders-arrow-circle">
                  <FontAwesomeIcon icon={tool.icon} />
                </div>
                <div className="pf-founders-item-text">
                  <h3 className="pf-founders-item-title">{tool.title}</h3>
                  <p className="pf-founders-item-desc">{tool.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="pf-founders-card-col">
          <ScrollReveal delay={200} duration={850} direction="up" distance="28px">
            <div className="pf-founders-revenue-card">
              <div className="pf-revenue-card-top">
                <span className="pf-rev-title">Parcours de paiement</span>
                <span className="pf-rev-icon-box">
                  <FontAwesomeIcon icon={faCode} />
                </span>
              </div>
              <div className="pf-rev-footer-metrics">
                <div className="pf-rev-metric-item">
                  <span className="pf-metric-label">Paiement</span>
                  <span className="pf-metric-val">Page hébergée PayDunya</span>
                </div>
                <div className="pf-rev-metric-item">
                  <span className="pf-metric-label">Confirmation</span>
                  <span className="pf-metric-val">Vérifiée côté serveur</span>
                </div>
              </div>
              <button
                type="button"
                className="pf-btn pf-btn-primary"
                onClick={() => onNavigate?.('/documentation')}
              >
                Voir la documentation <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  </section>
);
