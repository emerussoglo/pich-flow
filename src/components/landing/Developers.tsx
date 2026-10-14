import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faChartSimple,
} from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedCounter } from '../ui/AnimatedCounter';

export const Developers: React.FC<{ onNavigate?: (route: string) => void }> = () => {
  const steps = [
    {
      title: 'Connecte ton SaaS',
      desc: 'Une API simple et des SDK prêts à l’emploi pour brancher PichFlow à ton produit en quelques heures.',
    },
    {
      title: 'Facture des abonnements',
      desc: 'Crée des plans, gère les essais gratuits, les upgrades et les prélèvements automatiques.',
    },
    {
      title: 'Collecte partout',
      desc: 'Accepte les paiements de tes utilisateurs où qu’ils soient, en mobile money ou par carte.',
    },
    {
      title: 'Suis tes revenus',
      desc: 'Un tableau de bord unique pour visualiser ton MRR, tes churns et tes encaissements.',
    },
  ];

  const barHeights = [45, 60, 52, 28, 88, 98, 70];
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartVisible, setChartVisible] = useState(false);

  useEffect(() => {
    if (!chartRef.current || typeof IntersectionObserver === 'undefined') {
      setChartVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setChartVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="pf-founders-section">
      <div className="pf-container">
        {/* Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-founders-header">
            <div className="pf-badge-pill-purple">
              <span>Pour les founders</span>
            </div>
            <h2 className="pf-heading-purple-accent">
              Conçu pour les <span className="pf-italic-accent">SaaS</span>, du premier au millionième utilisateur
            </h2>
            <p className="pf-founders-subhead">
              PichFlow s’intègre directement à ton produit pour que tu puisses te concentrer sur ta croissance, pas sur la galère bancaire.
            </p>
          </div>
        </ScrollReveal>

        {/* 2-Columns Grid */}
        <div className="pf-founders-grid">
          {/* Left Column: 4 items with staggered reveal */}
          <div className="pf-founders-list">
            {steps.map((item, idx) => (
              <ScrollReveal key={idx} delay={idx * 120} duration={750} direction="up" distance="20px">
                <div className="pf-founders-item">
                  <div className="pf-founders-arrow-circle">
                    <FontAwesomeIcon icon={faArrowRight} />
                  </div>
                  <div className="pf-founders-item-text">
                    <h3 className="pf-founders-item-title">{item.title}</h3>
                    <p className="pf-founders-item-desc">{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Right Column: Monthly Revenue Card */}
          <div className="pf-founders-card-col">
            <ScrollReveal delay={200} duration={850} direction="up" distance="28px">
              <div className="pf-founders-revenue-card" ref={chartRef}>
                <div className="pf-revenue-card-top">
                  <span className="pf-rev-title">Revenus mensuels</span>
                  <span className="pf-rev-icon-box">
                    <FontAwesomeIcon icon={faChartSimple} />
                  </span>
                </div>

                <div className="pf-rev-stat-row">
                  <span className="pf-rev-amount">
                    <AnimatedCounter end={4260633} duration={2200} delay={200} /> FCFA
                  </span>
                  <span className="pf-rev-growth">
                    +<AnimatedCounter end={20} decimals={1} duration={1800} delay={300} />% ce mois-ci
                  </span>
                </div>

                {/* Bar Chart Visualization with smooth CSS transitions */}
                <div className="pf-rev-bars-chart">
                  {barHeights.map((h, i) => (
                    <div key={i} className="pf-rev-bar-track">
                      <div
                        className="pf-rev-bar-fill"
                        style={{
                          height: chartVisible ? `${h}%` : '0%',
                          transition: `height 900ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms`,
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="pf-rev-footer-metrics">
                  <div className="pf-rev-metric-item">
                    <span className="pf-metric-label">Abonnés actifs</span>
                    <span className="pf-metric-val">
                      <AnimatedCounter end={1284} duration={2000} delay={350} />
                    </span>
                  </div>
                  <div className="pf-rev-metric-item">
                    <span className="pf-metric-label">Taux de rétention</span>
                    <span className="pf-metric-val">
                      <AnimatedCounter end={96.4} decimals={1} duration={2000} delay={400} />%
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
};
