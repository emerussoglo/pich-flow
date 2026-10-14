import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight, faSliders } from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface PricingCalculatorProps {
  onNavigate?: (route: string) => void;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({ onNavigate }) => {
  const [monthlyVolume, setMonthlyVolume] = useState<number>(2500000);
  const [showSimulator, setShowSimulator] = useState<boolean>(true);

  const features = [
    'Aucun abonnement mensuel ni frais d’activation',
    'Aucun frais fixe caché ou mauvaise surprise',
    'Paiements Mobile Money (Orange, MTN, Wave, Moov) et cartes bancaires',
    'Abonnements récurrents & prélèvements automatiques illimités',
    'Versements instantanés vers vos comptes et portefeuilles',
    'Tableau de bord analytics en direct et webhooks inclus',
  ];

  // Fee calculation (1.75% + 100 FCFA approx per 25k average ticket = 100 transactions)
  const averageTicket = 25000;
  const estimatedTransactions = Math.max(1, Math.round(monthlyVolume / averageTicket));
  const variableFee = Math.round(monthlyVolume * 0.0175);
  const fixedFee = estimatedTransactions * 100;
  const totalFees = variableFee + fixedFee;
  const netRevenue = Math.max(0, monthlyVolume - totalFees);

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
              Pas d'abonnement. Tu paies <span className="pf-italic-accent">seulement</span> quand tu encaisses.
            </h2>

            <p className="pf-section-subhead">
              Aucun frais fixe, aucune mauvaise surprise. Tu ne paies rien tant que tu n'as pas généré de chiffre d'affaires.
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
              <div className="pf-pricing-card-rate">À partir de 1,75%</div>
              <div className="pf-pricing-card-fixed">+ 100 FCFA fixe par transaction</div>
              <div className="pf-pricing-card-limits">
                Appliqué sur les transactions entre 200 et 9 999 999 FCFA
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

            {/* Interactive Volume Simulator Toggle */}
            <div className="pf-pricing-simulator-toggle-box">
              <button
                type="button"
                onClick={() => setShowSimulator(!showSimulator)}
                className="pf-simulator-toggle-btn"
              >
                <FontAwesomeIcon icon={faSliders} />
                <span>{showSimulator ? 'Masquer le simulateur' : 'Simuler mes revenus nets'}</span>
              </button>

              {showSimulator && (
                <div className="pf-simulator-inline-panel">
                  <div className="pf-sim-slider-row">
                    <div className="pf-sim-label-left">
                      <span>Volume mensuel estimé :</span>
                      <strong>{monthlyVolume.toLocaleString('fr-FR')} FCFA</strong>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="100000"
                    max="20000000"
                    step="100000"
                    value={monthlyVolume}
                    onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                    className="pf-range-slider"
                    aria-label="Volume de vente mensuel"
                  />

                  <div className="pf-sim-results-grid">
                    <div className="pf-sim-res-box">
                      <span className="pf-sim-res-lbl">Frais totaux estimés</span>
                      <span className="pf-sim-res-val pf-text-muted">
                        ~{totalFees.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div className="pf-sim-res-box pf-box-highlight">
                      <span className="pf-sim-res-lbl">Tu reçois net sur ton compte</span>
                      <span className="pf-sim-res-val pf-text-blue">
                        {netRevenue.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
