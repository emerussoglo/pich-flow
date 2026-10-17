import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface PricingCalculatorProps {
  onNavigate?: (route: string) => void;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({ onNavigate }) => {
  const features = [
    'Liens de paiement associés à une application PichFlow',
    'Checkout hébergé et création de facture PayDunya',
    'Moyens de paiement collectés sur la page sécurisée PayDunya',
    'Clés API PichFlow révocables et limitées à leur application',
    'Suivi des statuts confirmé côté serveur',
    'Aucune surcharge PichFlow ajoutée au montant client',
  ];

  return (
    <section id="tarifs-section" className="pf-tarifs-section">
      <div className="pf-container">
        {/* Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-section-center-head">
            <div className="pf-badge-pill-blue">
              <span className="pf-pill-blue-dot" />
              <span>TARIFS SIMPLES</span>
            </div>

            <h2 className="pf-heading-blue-accent">
              Encaissez avec PayDunya depuis PichFlow
            </h2>

            <p className="pf-section-subhead">
              Les tarifs et méthodes disponibles dépendent de la configuration de votre compte PayDunya. PichFlow n’invente ni frais ni montant net.
            </p>
          </div>
        </ScrollReveal>

        {/* Centered Pricing Card */}
        <ScrollReveal delay={180} duration={850} direction="up" distance="24px">
          <div className="pf-pricing-card-wrapper">
            <div className="pf-pricing-single-card">
            <div className="pf-pricing-card-header-badge">
              <span className="pf-pricing-card-type">Tarification à la transaction</span>
            </div>

            <div className="pf-pricing-card-rate-box">
              <div className="pf-pricing-card-rate">Frais selon votre compte PayDunya</div>
              <div className="pf-pricing-card-fixed">Montant présenté par PayDunya au paiement</div>
              <div className="pf-pricing-card-limits">
                Les frais réels ne sont pas exposés par l’API actuellement utilisée.
              </div>
            </div>

            <div className="pf-pricing-card-divider" />

            <div className="pf-pricing-features-list">
              {features.map((item, idx) => (
                <div key={idx} className="pf-pricing-feature-row">
                  <div className="pf-feature-check-icon">
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Action CTA Button */}
            <div className="pf-pricing-cta-box">
              <div className="pf-btn-click-simulator-wrap">
              <button
                onClick={() => onNavigate?.('/register')}
                className="pf-saspay-btn-primary pf-btn-simulated-click"
                aria-label="Commencer sur PichFlow"
              >
                <span>Commencer</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>

              {/* Simulated auto-clicking mouse cursor */}
              <div className="pf-simulated-cursor" aria-hidden="true" title="Simulation de clic automatique">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="pf-cursor-svg"
                >
                  <path
                    d="M4.5 3.5L19 12L12.5 13.5L9 20L4.5 3.5Z"
                    fill="#0F172A"
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="pf-cursor-click-ring" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  </div>
</section>
  );
};
