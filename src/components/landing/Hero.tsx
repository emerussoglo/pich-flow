import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faLink, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface HeroProps {
  onNavigate: (path: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate }) => (
  <section className="pf-hero-section pf-hero-saspay">
    <div className="pf-container pf-hero-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-hero-content">
          <div className="pf-badge-pill-blue">
            <span className="pf-pill-blue-dot" />
            <span>Checkout hébergé par PayDunya</span>
          </div>
          <h1 className="pf-hero-title">
            Crée des liens de paiement
            <br />
            <span className="pf-italic-accent">pour ton activité.</span>
          </h1>
          <p className="pf-hero-subtitle">
            PichFlow te permet de créer des liens de paiement en XOF pour le Bénin.
            Le paiement est traité sur la page sécurisée de PayDunya ; les moyens
            disponibles dépendent de la configuration de ton compte PayDunya.
          </p>
          <div className="pf-hero-actions">
            <button
              type="button"
              className="pf-btn pf-btn-primary pf-btn-lg"
              onClick={() => onNavigate('/register')}
            >
              Créer un compte
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button
              type="button"
              className="pf-btn pf-btn-secondary pf-btn-lg"
              onClick={() => onNavigate('/pricing')}
            >
              Voir les tarifs
            </button>
          </div>
          <p className="pf-hero-disclaimer">
            Les frais PayDunya applicables sont ceux de votre compte et ne sont pas
            estimés par PichFlow.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={180} duration={800} direction="up">
        <div className="pf-hero-visual" aria-label="Aperçu des fonctionnalités PichFlow">
          <div className="pf-hero-preview-card">
            <div className="pf-hero-preview-heading">
              <span className="pf-hero-preview-icon">
                <FontAwesomeIcon icon={faLink} />
              </span>
              <div>
                <strong>Lien de paiement</strong>
                <span>Exemple d’interface, sans transaction réelle</span>
              </div>
            </div>
            <div className="pf-hero-preview-link">
              <span>URL publique générée après création</span>
            </div>
            <div className="pf-hero-preview-status">
              <FontAwesomeIcon icon={faShieldHalved} />
              <span>Le statut est confirmé côté serveur auprès de PayDunya</span>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
