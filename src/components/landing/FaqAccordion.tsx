import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faMinus,
  faArrowRight,
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
      a: "Oui. Vous pouvez créer un lien de paiement depuis le dashboard et partager son URL. Le checkout est hébergé par PayDunya.",
    },
    {
      num: '02',
      q: "Combien de temps avant d'activer mes paiements ?",
      a: "Une facture a été créée et vérifiée en Sandbox. Le mode production et les moyens activés n’ont pas été vérifiés : ils dépendent de la configuration et de la validation de votre compte PayDunya.",
    },
    {
      num: '03',
      q: "Est-ce que je peux suivre mes encaissements depuis mon téléphone ?",
      a: "Le dashboard permet de consulter les ressources de l’application sélectionnée. PichFlow n’affiche pas de solde officiel PayDunya et n’intègre pas de retraits.",
    },
    {
      num: '04',
      q: "Et si une transaction bloque en cours de route ?",
      a: "Le statut reste en attente jusqu’à sa confirmation côté serveur auprès de PayDunya. Vous pouvez demander une nouvelle vérification ; PichFlow ne bascule pas entre des opérateurs.",
    },
    {
      num: '05',
      q: "Quels frais s'appliquent aux paiements ?",
      a: "Les frais PayDunya applicables dépendent de votre compte et ne sont pas exposés par l’API utilisée. PichFlow n’ajoute pas de surcharge au montant demandé et n’affiche pas de frais estimés.",
    },
    {
      num: '06',
      q: "Comment retirer mes fonds ?",
      a: "Les retraits et virements ne sont pas intégrés dans PichFlow. Consultez votre compte PayDunya pour connaître les fonds disponibles et les modalités de versement.",
    },
    {
      num: '07',
      q: "Comment je commence après l'inscription ?",
      a: "Après la création de votre compte, sélectionnez ou créez une application dans le dashboard, puis créez un lien de paiement. Pour les tests, utilisez l’environnement Sandbox configuré.",
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

          {/* Bottom call to action */}
          <div className="pf-faq-bottom-card">
            <div className="pf-faq-bottom-text">
              <div className="pf-faq-bottom-title">Tu as toutes tes réponses ?</div>
              <div className="pf-faq-bottom-sub">Consulte les fonctionnalités réellement disponibles avant de configurer ton compte.</div>
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
              Crée un compte pour configurer une application et générer un lien de paiement en XOF pour le Bénin.
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
