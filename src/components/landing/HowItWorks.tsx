import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faLock,
  faEye,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { ScrollReveal } from '../ui/ScrollReveal';

interface HowItWorksProps {
  onNavigate?: (route: string) => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [companyName, setCompanyName] = useState('Mon SaaS');
  const [email, setEmail] = useState('votremail@gmail.com');
  const [password, setPassword] = useState('••••••••');

  const handleSimulateSignup = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Compte Sandbox créé avec succès !', 'success');
    if (onNavigate) onNavigate('/dashboard');
  };

  return (
    <section id="demarrage-rapide" className="pf-how-it-works-section">
      <div className="pf-container">
        {/* Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-section-center-head">
            <div className="pf-badge-pill-purple">
              <span>Processus d'intégration</span>
            </div>
            <h2 className="pf-heading-purple-accent">
              Lancez vos encaissements en quelques <span className="pf-italic-accent">instants</span>
            </h2>
          </div>
        </ScrollReveal>

        {/* 2-Columns Grid */}
        <div className="pf-how-it-works-grid">
          {/* Left Column: 3 Numbered Steps */}
          <div className="pf-steps-list-col">
            {/* Step 1 */}
            <div className="pf-step-row-item">
              <div className="pf-step-number-circle">1</div>
              <div className="pf-step-row-content">
                <h3 className="pf-step-row-title">Enregistrez votre profil</h3>
                <p className="pf-step-row-desc">
                  Ouvrez votre accès marchand instantanément. Renseignez les coordonnées de votre structure, validez votre identité et pilotez votre activité depuis votre console dédiée.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="pf-step-row-item">
              <div className="pf-step-number-circle">2</div>
              <div className="pf-step-row-content">
                <h3 className="pf-step-row-title">Intégrez et paramétrez</h3>
                <p className="pf-step-row-desc">
                  Connectez votre plateforme à notre infrastructure via nos passerelles robustes et activez instantanément les solutions de paiement locales et internationales.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="pf-step-row-item">
              <div className="pf-step-number-circle">3</div>
              <div className="pf-step-row-content">
                <h3 className="pf-step-row-title">Monétisez et développez-vous</h3>
                <p className="pf-step-row-desc">
                  Recevez les règlements de votre communauté, automatisez la gestion de vos abonnements récurrents et suivez vos performances financières en direct.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Mockup Sign Up Card */}
          <div className="pf-signup-card-col">
            <div className="pf-signup-mock-card">
              <div className="pf-mock-header">
                <div className="pf-mock-title">Accès immédiat</div>
              </div>

              <form onSubmit={handleSimulateSignup} className="pf-mock-form">
                <div className="pf-mock-field">
                  <label>Raison sociale</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pf-mock-input"
                  />
                </div>

                <div className="pf-mock-field">
                  <label>Courriel professionnel</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pf-mock-input"
                  />
                </div>

                <div className="pf-mock-field">
                  <label>Clé de sécurité</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pf-mock-input"
                  />
                </div>

                <button type="submit" className="pf-mock-submit-btn">
                  Ouvrir mon compte
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const SecuritySection: React.FC = () => {
  return (
    <section id="securite-section" className="pf-security-dark-section">
      <div className="pf-container">
        {/* Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-section-center-head">
            <div className="pf-badge-pill-security">
              <span>Sécurité</span>
            </div>
            <h2 className="pf-heading-security-white">
              La sécurité au cœur de <span className="pf-italic-security-accent">chaque paiement.</span>
            </h2>
          </div>
        </ScrollReveal>

        {/* 4 Cards Grid */}
        <div className="pf-security-cards-grid">
          {/* Card 1 */}
          <ScrollReveal delay={100} duration={750} direction="up" distance="20px">
            <div className="pf-security-card">
              <div className="pf-security-icon-circle">
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
              <h3 className="pf-security-card-title">Des paiements protégés</h3>
              <p className="pf-security-card-desc">
                Protège les échanges liés à tes transactions grâce à des mécanismes de sécurité conçus pour préserver l'intégrité des opérations.
              </p>
            </div>
          </ScrollReveal>

          {/* Card 2 */}
          <ScrollReveal delay={200} duration={750} direction="up" distance="20px">
            <div className="pf-security-card">
              <div className="pf-security-icon-circle">
                <FontAwesomeIcon icon={faLock} />
              </div>
              <h3 className="pf-security-card-title">Des données confidentielles</h3>
              <p className="pf-security-card-desc">
                Les données sensibles doivent rester protégées à chaque étape, grâce à des pratiques de sécurité adaptées aux échanges numériques.
              </p>
            </div>
          </ScrollReveal>

          {/* Card 3 */}
          <ScrollReveal delay={300} duration={750} direction="up" distance="20px">
            <div className="pf-security-card">
              <div className="pf-security-icon-circle">
                <FontAwesomeIcon icon={faEye} />
              </div>
              <h3 className="pf-security-card-title">Une vigilance continue</h3>
              <p className="pf-security-card-desc">
                Identifie les comportements inhabituels et renforce la surveillance des transactions pour mieux prévenir les activités suspectes.
              </p>
            </div>
          </ScrollReveal>

          {/* Card 4 */}
          <ScrollReveal delay={400} duration={750} direction="up" distance="20px">
            <div className="pf-security-card">
              <div className="pf-security-icon-circle">
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <h3 className="pf-security-card-title">Conformité</h3>
              <p className="pf-security-card-desc">
                Construis ton activité sur une base fiable, avec des pratiques de sécurité adaptées aux exigences des paiements en ligne.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
