import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faLink, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface HeroProps {
  onNavigate: (path: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate }) => (
  <section className="pf-hero-saspay">
    <div className="pf-saspay-glow" aria-hidden="true" />
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-saspay-header">
          <div className="pf-saspay-pill">
            <span className="pf-badge-content">
              <span className="pf-badge-highlight">Checkout hébergé</span>
              <span className="pf-badge-text">PayDunya</span>
            </span>
          </div>
          <h1 className="pf-saspay-title">
            Crée des liens de paiement
            <br />
            <span className="pf-saspay-title-italic">pour ton activité.</span>
          </h1>
          <p className="pf-saspay-subtitle">
            PichFlow te permet de créer des liens de paiement en XOF pour le Bénin.
            Le paiement est traité sur la page sécurisée de PayDunya ; les moyens
            disponibles dépendent de la configuration de ton compte PayDunya.
          </p>
          <div className="pf-saspay-actions">
            <button
              type="button"
              className="pf-saspay-btn-primary"
              onClick={() => onNavigate('/register')}
            >
              Créer un compte
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button
              type="button"
              className="pf-saspay-btn-secondary"
              onClick={() => onNavigate('/pricing')}
            >
              Voir les tarifs
            </button>
          </div>
          <p className="pf-section-subhead">
            Les frais PayDunya applicables sont ceux de votre compte et ne sont pas
            estimés par PichFlow.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={180} duration={800} direction="up">
        <div className="pf-hero-floating-stage" aria-label="Aperçu illustratif, sans transaction réelle">
          <div className="pf-floating-glow-backdrop" aria-hidden="true" />
          <div className="pf-float-card-link">
            <div className="pf-card-link-header">
              <span className="pf-card-pro-icon">
                <FontAwesomeIcon icon={faLink} />
              </span>
              <div>
                <div className="pf-card-link-title">Aperçu d’un lien</div>
                <div className="pf-card-link-sub">Exemple d’interface — pas une transaction réelle</div>
              </div>
            </div>
            <div className="pf-card-link-box">
              <span className="pf-card-link-url">URL générée après création enregistrée</span>
            </div>
            <div className="pf-card-link-sub">
              <FontAwesomeIcon icon={faShieldHalved} />
              {' '}Statut confirmé côté serveur auprès de PayDunya
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
