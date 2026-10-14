import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faArrowsRotate,
  faCheck,
  faCopy,
  faEnvelope,
  faLink,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useToast } from '../ui/ToastContext';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedCounter } from '../ui/AnimatedCounter';

interface HeroProps {
  onNavigate: (route: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText('link.pichflow.me/facture-082');
    setCopiedLink(true);
    showToast('Lien de paiement copié !', 'success');
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <section className="pf-hero-saspay">
      {/* Soft Ambient Radial Lights (Clean White Theme with soft purple glow) */}
      <div className="pf-saspay-glow" aria-hidden="true" />

      <div className="pf-container">
        {/* CENTERED EDITORIAL HEADER (Exact SasPay composition with staggered Reveal) */}
        <div className="pf-saspay-header">
          {/* Eyebrow Pill */}
          <ScrollReveal delay={0} duration={750} direction="up" distance="20px">
            <div className="pf-saspay-pill">
              {/* Stack d'avatars de clients / utilisateurs */}
              <div className="pf-avatar-group">
                <img
                  src="https://images.unsplash.com/photo-1563132337-f159f484226c?q=80&w=387&auto=format&fit=crop&ixlib"
                  alt="Utilisateur 1"
                  className="pf-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1637684666772-1f215bfd0f5d?q=80&w=388&auto=format&fit=crop&ixlib"
                  alt="Utilisateur 2"
                  className="pf-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1561406636-b80293969660?q=80&w=387&auto=format&fit=crop&ixlib"
                  alt="Utilisateur 3"
                  className="pf-avatar"
                />
                <img
                  src="https://plus.unsplash.com/premium_photo-1758836220645-9d0373498f98?q=80&w=870&auto=format&fit=crop&ixlib"
                  alt="Utilisateur 4"
                  className="pf-avatar"
                />
              </div>

              {/* Texte d'amorce / Preuve sociale */}
              <div className="pf-badge-content">
                <span className="pf-badge-highlight">+200 utilisateurs</span>
                <span className="pf-badge-text">déjà</span>
              </div>

              <FontAwesomeIcon icon={faArrowRight} className="pf-badge-arrow" />
            </div>
          </ScrollReveal>

          {/* Centered H1 */}
          <ScrollReveal delay={140} duration={800} direction="up" distance="24px">
            <h1 className="pf-saspay-title">
              L'infrastructure de <br />
              <span className="pf-saspay-title-italic">paiement</span> moderne pour l'Afrique
            </h1>
          </ScrollReveal>

          {/* Concise, punchy subtitle */}
          <ScrollReveal delay={280} duration={800} direction="up" distance="24px">
            <p className="pf-saspay-subtitle">
              Encaissez partout, automatisez vos abonnements et recevez vos paiements en toute simplicité, par Mobile Money et carte bancaire.
            </p>
          </ScrollReveal>

          {/* Centered CTA Buttons with Simulated Clicking Cursor */}
          <ScrollReveal delay={420} duration={800} direction="up" distance="20px">
            <div className="pf-saspay-actions">
              <div className="pf-btn-click-simulator-wrap">
                <button
                  onClick={() => onNavigate('/register')}
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

              <button
                onClick={() => onNavigate('/pricing')}
                className="pf-saspay-btn-secondary"
                aria-label="Voir la tarification"
              >
                <span>Voir nos tarifs</span>
              </button>
            </div>
          </ScrollReveal>
        </div>

        {/* 3 FLOATING CARDS CONNECTED WITH SVG CURVED DASHED LINES */}
        <ScrollReveal delay={540} duration={900} direction="up" distance="28px">
          <div className="pf-hero-floating-stage">
            {/* Background ambient radial glow for the cards */}
            <div className="pf-floating-glow-backdrop" aria-hidden="true" />

            {/* Lignes SVG de connexion en pointillés (Inspiré de l'image de référence) */}
            <svg className="pf-floating-connectors-svg" aria-hidden="true" viewBox="0 0 900 380" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pf-connector-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              
              {/* Ligne pointillée : Carte 1 (Abonnement Pro) -> Carte 2 (Solde) */}
              <path
                d="M 230 140 C 230 220, 280 250, 310 270"
                fill="none"
                stroke="url(#pf-connector-gradient)"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />

              {/* Ligne pointillée : Carte 2 (Solde) -> Carte 3 (Lien de paiement) */}
              <path
                d="M 520 280 C 600 280, 620 180, 680 150"
                fill="none"
                stroke="url(#pf-connector-gradient)"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
            </svg>

            {/* CARD 1 (LEFT): Facturation Récurrente */}
            <div className="pf-float-card-pro">
              <div className="pf-card-pin" />
              <div className="pf-card-pro-header">
                <div className="pf-card-pro-icon">
                  <FontAwesomeIcon icon={faArrowsRotate} />
                </div>
                <span className="pf-card-pro-title">Facturation SaaS</span>
              </div>

              <div className="pf-card-pro-subbox">
                <div className="pf-card-pro-plan-row">
                  <span className="pf-card-pro-plan-name">Formule illimitée</span>
                  <span className="pf-card-pro-badge-active">En cours</span>
                </div>
                <div className="pf-card-pro-renew">Échéance le 12</div>
              </div>

              <div className="pf-card-pro-next-row">
                <div className="pf-card-pro-next-label">Prochaine facturation</div>
                <div className="pf-card-pro-next-amount">
                  <AnimatedCounter end={25000} duration={2000} delay={500} /> FCFA
                </div>
              </div>
            </div>

            {/* CARD 2 (BOTTOM-CENTER, OVERLAPPING): Trésorerie globale */}
            <div className="pf-float-card-balance">
              <div className="pf-card-pin" />
              <div className="pf-card-balance-label">Trésorerie encaissée</div>
              <div className="pf-card-balance-amount">
                <AnimatedCounter end={8450000} duration={2400} delay={600} /> <span className="pf-card-balance-curr">FCFA</span>
              </div>
              <div className="pf-card-balance-usd">≈ 13 700,00 USD</div>
            </div>

            {/* CARD 3 (RIGHT): Module d'encaissement rapide */}
            <div className="pf-float-card-link">
              <div className="pf-card-pin" />
              <div className="pf-card-link-header">
                <div className="pf-card-link-check">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="pf-card-link-titles">
                  <div className="pf-card-link-title">Lien de caisse généré</div>
                  <div className="pf-card-link-sub">Opérationnel</div>
                </div>
              </div>

              <div className="pf-card-link-box">
                <span className="pf-card-link-url">pay.pichflow.me/cmd-994...</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="pf-card-link-copy"
                >
                  <FontAwesomeIcon icon={faCopy} />
                  <span>{copiedLink ? 'Validé !' : 'Copier'}</span>
                </button>
              </div>

              <div className="pf-card-link-shares">
                <button type="button" className="pf-share-circle pf-share-mail" title="Transmettre par courriel">
                  <FontAwesomeIcon icon={faEnvelope} />
                </button>
                <button type="button" className="pf-share-circle pf-share-link" onClick={handleCopyLink} title="Dupliquer l'adresse">
                  <FontAwesomeIcon icon={faLink} />
                </button>
                <button type="button" className="pf-share-circle pf-share-whatsapp" title="Diffuser via WhatsApp">
                  <FontAwesomeIcon icon={faWhatsapp} />
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
