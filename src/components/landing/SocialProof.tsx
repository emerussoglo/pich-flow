import React from 'react';
import { ScrollReveal } from '../ui/ScrollReveal';

export const SocialProof: React.FC = () => (
  <section className="pf-saas-logos-section">
    <div className="pf-container">
      <ScrollReveal delay={0} duration={750} direction="up" distance="16px">
        <p className="pf-saas-logos-title">Paiement hébergé par PayDunya</p>
      </ScrollReveal>
      <p style={{ textAlign: 'center', color: '#64748B', margin: '0 auto 1rem', maxWidth: 720 }}>
        Les moyens de paiement effectivement activés sur votre compte sont affichés et traités sur la page sécurisée PayDunya.
        PichFlow ne présente pas de réseau comme disponible sans confirmation du fournisseur.
      </p>
    </div>
    <div className="pf-marquee-container" aria-label="Checkout hébergé PayDunya">
      <div className="pf-marquee-fade-left" aria-hidden="true" />
      <div className="pf-marquee-track">
        <div className="pf-marquee-item">
          <div className="pf-marquee-icon-box" aria-hidden="true">PD</div>
          <div className="pf-marquee-text-col">
            <span className="pf-marquee-name">Checkout PayDunya</span>
            <span className="pf-marquee-category">Moyens du compte marchand</span>
          </div>
        </div>
      </div>
      <div className="pf-marquee-fade-right" aria-hidden="true" />
    </div>
  </section>
);
