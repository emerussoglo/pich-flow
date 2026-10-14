import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faArrowsRotate,
  faClock,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedCounter } from '../ui/AnimatedCounter';

interface FeaturesProps {
  onNavigate?: (route: string) => void;
}

export const Features: React.FC<FeaturesProps> = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="capacites-section" className="pf-capacites-section" ref={sectionRef}>
      <div className="pf-container">
        {/* Section Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-section-center-head">
            <div className="pf-badge-pill-blue">
              <span className="pf-pill-blue-dot" />
              <span>Capacités</span>
            </div>
            <h2 className="pf-heading-blue-accent">
              Tous tes paiements, <span className="pf-italic-accent">en un seul endroit.</span>
            </h2>
          </div>
        </ScrollReveal>

        {/* 2x2 Cards Grid with staggered reveal */}
        <div className="pf-capacites-grid">
          {/* Card 1: Des paiements sans frontières */}
          <ScrollReveal delay={100} duration={800} direction="up" distance="24px">
            <div className="pf-capacite-card">
              <div className="pf-capacite-icon-box">
                <FontAwesomeIcon icon={faGlobe} />
              </div>
              <h3 className="pf-capacite-title">Encaisse sans frontières</h3>
              <p className="pf-capacite-desc">
                Accepte les paiements par Mobile Money et carte bancaire pour offrir à tes clients une expérience de paiement simple et fluide.
              </p>

              <div className="pf-capacite-mini-ui">
                <div className="pf-mini-ui-row">
                  <span className="pf-mini-ui-label">MTN Money BJ</span>
                  <span className="pf-mini-ui-status">
                    <span className="pf-mini-dot-green" /> Réussi
                  </span>
                </div>
                <div className="pf-mini-ui-row">
                  <span className="pf-mini-ui-label">Carte Visa •••• 4022</span>
                  <span className="pf-mini-ui-status">
                    <span className="pf-mini-dot-green" /> Réussi
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 2: L'abonnement, en toute simplicité */}
          <ScrollReveal delay={200} duration={800} direction="up" distance="24px">
            <div className="pf-capacite-card">
              <div className="pf-capacite-icon-box">
                <FontAwesomeIcon icon={faArrowsRotate} />
              </div>
              <h3 className="pf-capacite-title">Automatise tes abonnements</h3>
              <p className="pf-capacite-desc">
                Configure tes paiements récurrents et simplifie la facturation de tes clients pour te concentrer 
                sur la croissance de ton activité.
              </p>

              <div className="pf-capacite-mini-ui">
                <div className="pf-mini-plan-header">
                  <span className="pf-mini-plan-name">Plan Business</span>
                  <span className="pf-mini-plan-badge">Automatique</span>
                </div>
                <div className="pf-mini-plan-progress-bar">
                  <div
                    className="pf-mini-plan-progress-fill"
                    style={{
                      width: isVisible ? '42%' : '0%',
                      transition: 'width 1200ms cubic-bezier(0.16, 1, 0.3, 1) 300ms',
                    }}
                  />
                </div>
                <div className="pf-mini-plan-sub">Prochaine échéance dans 12 jours</div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 3: Payé en quelques secondes */}
          <ScrollReveal delay={300} duration={800} direction="up" distance="24px">
            <div className="pf-capacite-card">
              <div className="pf-capacite-icon-box">
                <FontAwesomeIcon icon={faClock} />
              </div>
              <h3 className="pf-capacite-title">Suis tes paiements en temps réel</h3>
              <p className="pf-capacite-desc">
                Garde le contrôle sur tes encaissements et tes versements grâce à une visibilité claire sur les mouvements de ton compte.
              </p>

              <div className="pf-capacite-mini-ui">
                <div className="pf-mini-payout-box">
                  <div className="pf-mini-payout-icon">
                    <FontAwesomeIcon icon={faClock} />
                  </div>
                  <div className="pf-mini-payout-info">
                    <div className="pf-mini-payout-title">Versement envoyé</div>
                    <div className="pf-mini-payout-meta">
                      <AnimatedCounter end={120000} duration={2000} delay={400} /> FCFA • à l'instant
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 4: Intelligence des revenus */}
          <ScrollReveal delay={400} duration={800} direction="up" distance="24px">
            <div className="pf-capacite-card">
              <div className="pf-capacite-icon-box">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <h3 className="pf-capacite-title">Garde une vue claire sur tes revenus</h3>
              <p className="pf-capacite-desc">
                Analyse tes revenus, suis tes transactions et identifie les tendances qui comptent pour piloter ton activité.
              </p>

              <div className="pf-capacite-mini-ui">
                <div className="pf-mini-revenue-box">
                  <div>
                    <div className="pf-mini-rev-label">Revenus cumulés</div>
                    <div className="pf-mini-rev-amount">
                      <AnimatedCounter end={5350000} duration={2200} delay={500} /> FCFA
                    </div>
                  </div>
                  <div className="pf-mini-rev-sparkline">
                    <svg viewBox="0 0 160 36" fill="none" className="pf-sparkline-svg">
                      <path
                        d="M2 30 L40 28 L70 20 L105 24 L135 12 L158 14"
                        stroke="#2563EB"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: 200,
                          strokeDashoffset: isVisible ? 0 : 200,
                          transition: 'stroke-dashoffset 1500ms cubic-bezier(0.16, 1, 0.3, 1) 400ms',
                        }}
                        className={isVisible ? 'pf-sparkline-path animated' : 'pf-sparkline-path'}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};