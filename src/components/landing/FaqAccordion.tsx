import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface StartButtonSimulatorProps {
  onNavigate: (route: string) => void;
}
import {
  faPlus,
  faMinus,
  faArrowRight,
  faBolt,
  faCheck,
  faComments,
} from '@fortawesome/free-solid-svg-icons';
import { ScrollReveal } from '../ui/ScrollReveal';

interface FaqAccordionProps {
  onNavigate?: (route: string) => void;
}

export const FaqAccordion: React.FC<FaqAccordionProps> = ({ onNavigate }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default for immediate preview

  const faqItems = [
    {
      num: '01',
      q: "Je n'ai jamais codé de ma vie. C'est vraiment possible ?",
      a: "Oui, absolument. PichFlow propose des liens de paiement prêts à l'emploi et un checkout hébergé que vous pouvez partager directement sur WhatsApp, Instagram ou par e-mail sans écrire une seule ligne de code.",
    },
    {
      num: '02',
      q: "Combien de temps avant d'activer mes paiements ?",
      a: "Votre compte Sandbox est actif instantanément dès la création de votre compte. L'activation de l'environnement Live pour recevoir de vrais fonds prend généralement moins de 24 heures après vérification des informations de base.",
    },
    {
      num: '03',
      q: "Est-ce que je peux suivre mes encaissements depuis mon téléphone ?",
      a: "Oui. Le tableau de bord PichFlow est 100% responsive et optimisé pour smartphone. Vous pouvez consulter vos soldes, vérifier les transactions en temps réel et ordonner des retraits directement depuis votre téléphone.",
    },
    {
      num: '04',
      q: "Et si une transaction bloque en cours de route ?",
      a: "PichFlow dispose d'un routage intelligent multi-opérateurs et d'une gestion automatique de l'idempotence. Si un réseau Mobile Money ralentit, la passerelle bascule ou retente immédiatement sans jamais dédoubler un débit.",
    },
    {
      num: '05',
      q: "Dois-je payer un abonnement pour les outils ?",
      a: "Non. PichFlow fonctionne à 100% à la commission par transaction réussie. Vous ne payez aucun abonnement mensuel, aucun frais de mise en service et aucun coût fixe si vous n'encaissez rien.",
    },
    {
      num: '06',
      q: "Comment et quand sont versés mes fonds ?",
      a: "Vos fonds sont disponibles dans vos portefeuilles par pays. Vous pouvez déclencher un retrait instantané vers vos numéros Mobile Money marchands ou planifier un virement bancaire automatique vers votre compte (BOA, Ecobank, etc.).",
    },
    {
      num: '07',
      q: "Comment je commence après l'inscription ?",
      a: "Dès votre inscription validée, vous accédez directement au tableau de bord. Vous pouvez créer votre premier lien de paiement en 30 secondes ou copier vos clés API Sandbox pour commencer vos tests.",
    },
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq-section" className="pf-faq-section-white">
      <div className="pf-container">
        {/* Header */}
        <ScrollReveal delay={0} duration={800} direction="up">
          <div className="pf-section-center-head">
            <div className="pf-badge-pill-blue">
              <span className="pf-pill-blue-dot" />
              <span>RÉPONSES CLAIRES</span>
            </div>
            <h2 className="pf-faq-main-title">
              Ce qui te retient encore
            </h2>
            <p className="pf-faq-main-subtitle">
              Les objections et questions qu'on nous pose le plus souvent. Traitées en toute transparence.
            </p>
          </div>
        </ScrollReveal>

        {/* FAQ Container with Pure White Background */}
        <ScrollReveal delay={150} duration={850} direction="up" distance="24px">
          <div className="pf-faq-white-container">
          <div className="pf-faq-list-rows">
            {faqItems.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={idx} className={`pf-faq-row-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="pf-faq-row-trigger"
                    aria-expanded={isOpen}
                  >
                    <div className="pf-faq-trigger-left">
                      <span className="pf-faq-row-num">{item.num}</span>
                      <span className="pf-faq-row-question">{item.q}</span>
                    </div>
                    <span className="pf-faq-toggle-icon">
                      <FontAwesomeIcon icon={isOpen ? faMinus : faPlus} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pf-faq-row-answer">
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Call-To-Action Row matching competitor style */}
          <div className="pf-faq-bottom-card">
            <div className="pf-faq-bottom-text">
              <div className="pf-faq-bottom-title">Tu as toutes tes réponses ?</div>
              <div className="pf-faq-bottom-sub">Il ne reste plus qu’à lancer tes encaissements.</div>
            </div>

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
        </ScrollReveal>
      </div>
    </section>
  );
};

export const FinalCta: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  return (
    <section className="pf-final-cta-section">
      <div className="pf-container">
        <ScrollReveal delay={0} duration={850} direction="up" distance="28px">
          <div className="pf-final-cta-banner">
            {/* Effets lumineux d'arrière-plan (Glows & Arcs bleus) */}
            <div className="pf-final-cta-glow" aria-hidden="true" />
            <div className="pf-cta-arc-left" aria-hidden="true" />
            <div className="pf-cta-arc-right" aria-hidden="true" />

            {/* Tag / Badge */}
            <div className="pf-final-cta-pill">
              <span className="pf-final-pill-dot" />
              <span>ACCÉLÉRATEUR DE CROISSANCE</span>
            </div>

            {/* Titre principal */}
            <h2 className="pf-final-cta-title">
              Prêt à être payé, <span className="pf-italic-cta-blue">façon SaaS</span> ?
            </h2>

            {/* Description */}
            <p className="pf-final-cta-desc">
              Crée ton compte en quelques minutes et commence à encaisser partout en Afrique, sans abonnement ni engagement.
            </p>

            {/* Boutons d'action */}
            <div className="pf-final-cta-actions">
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
                className="pf-final-btn-glass"
              >
                <span>Voir la tarification</span>
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
