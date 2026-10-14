import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faCheck,
  faLink,
  faShareNodes,
  faCircleCheck,
  faArrowRight,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';

import { ScrollReveal } from '../ui/ScrollReveal';

interface PaymentLinksDemoProps {
  onNavigate?: (route: string) => void;
}

export const PaymentLinksDemo: React.FC<PaymentLinksDemoProps> = ({ onNavigate }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const sampleLink = 'https://pay.pichflow.com/l/commande-1024';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sampleLink);
    setCopied(true);
    showToast('Lien de paiement copié !', 'success');
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section className="pf-section">
      <div className="pf-container">
        <div className="pf-two-col-grid">
          {/* Editorial Column */}
          <ScrollReveal direction="left" duration={800} distance="30px">
            <div className="pf-col-editorial">
            <div className="pf-section-badge">
              <FontAwesomeIcon icon={faLink} />
              <span>LIENS DE PAIEMENT</span>
            </div>

            <h2 className="pf-section-title">
              Faites-vous payer avec un simple lien.
            </h2>

            <p className="pf-section-desc">
              Partagez une page d'encaissement prête à l'emploi directement sur WhatsApp, par email, sur vos réseaux ou vos factures. Aucun développement requis.
            </p>

            <div className="pf-features-checklist">
              <div className="pf-checklist-item">
                <FontAwesomeIcon icon={faCircleCheck} className="pf-check-icon" />
                <span>Montant fixe ou montant libre (dons, acomptes)</span>
              </div>
              <div className="pf-checklist-item">
                <FontAwesomeIcon icon={faCircleCheck} className="pf-check-icon" />
                <span>Reçu automatique envoyé au client après confirmation</span>
              </div>
              <div className="pf-checklist-item">
                <FontAwesomeIcon icon={faCircleCheck} className="pf-check-icon" />
                <span>Gestion de date d'expiration et limitation d'usages</span>
              </div>
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('register')}
                className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                style={{ marginTop: '1rem' }}
              >
                <span>Créer mon premier lien</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            )}
            </div>
          </ScrollReveal>

          {/* Interactive Showcase Card */}
          <ScrollReveal direction="right" duration={850} delay={150} distance="30px">
            <div className="pf-col-visual">
              <div className="pf-payment-link-mockup-card">
                <div className="pf-link-mockup-header">
                  <div className="pf-link-mockup-badge">
                    <span className="pf-badge-dot"></span> Actif
                  </div>
                  <span className="pf-link-mockup-created">Créé il y a 5 min</span>
                </div>

                <div className="pf-link-mockup-body">
                  <h3 className="pf-link-mockup-title">Pack Formation Cloud & Fintech</h3>
                  <p className="pf-link-mockup-desc">
                    Accès complet aux 6 modules en ligne et support communautaire.
                  </p>

                  <div className="pf-link-mockup-amount-row">
                    <span className="pf-link-amount-label">Montant fixé</span>
                    <span className="pf-link-amount-val">15 000 XOF</span>
                  </div>

                  <div className="pf-link-copy-box">
                    <span className="pf-link-box-url">{sampleLink}</span>
                    <button
                      onClick={handleCopyLink}
                      className="pf-btn pf-btn-primary pf-btn-sm"
                    >
                      <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                      <span>{copied ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </div>

                <div className="pf-link-mockup-footer">
                  <div className="pf-share-hint">
                    <FontAwesomeIcon icon={faPaperPlane} style={{ color: 'var(--pf-primary)' }} />
                    <span>Prêt à être envoyé à votre client</span>
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
