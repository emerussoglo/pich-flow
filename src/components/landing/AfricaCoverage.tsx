import React from 'react';
import { ScrollReveal } from '../ui/ScrollReveal';

export const AfricaCoverage: React.FC = () => (
  <section id="couverture-section" className="pf-couverture-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={800} direction="up">
        <div className="pf-section-center-head">
          <div className="pf-badge-pill-blue">
            <span className="pf-pill-blue-dot" />
            <span>Disponibilité</span>
          </div>
          <h2 className="pf-heading-blue-accent">
            Une couverture <span className="pf-italic-accent">claire et vérifiable.</span>
          </h2>
          <p className="pf-section-subhead">
            Le checkout PichFlow est actuellement configuré pour le Bénin en XOF.
            La disponibilité des moyens de paiement dépend des options activées
            sur le compte PayDunya du marchand.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100} duration={700} direction="up" distance="18px">
        <div className="pf-country-card">
          <div className="pf-country-card-header">
            <div className="pf-country-title-row">
              <span className="pf-country-flag" role="img" aria-label="Bénin">🇧🇯</span>
              <span className="pf-country-name">Bénin</span>
            </div>
            <span className="pf-country-rate-badge">XOF</span>
          </div>
          <p className="pf-section-subhead">
            Une création de facture a été vérifiée en environnement Sandbox.
            PichFlow ne confirme pas ici la disponibilité en production ni les
            frais appliqués par PayDunya.
          </p>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
