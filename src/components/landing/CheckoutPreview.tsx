import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faMobileScreen,
  faCreditCard,
  faLock,
  faCheck,
  faSpinner,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { ScrollReveal } from '../ui/ScrollReveal';

interface CheckoutPreviewProps {
  onOpenDemo: () => void;
}

export const CheckoutPreview: React.FC<CheckoutPreviewProps> = ({ onOpenDemo }) => {
  const [selectedMethod, setSelectedMethod] = useState<'mtn' | 'moov' | 'card'>('mtn');
  const [phone, setPhone] = useState('97 12 34 56');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedSuccess, setSimulatedSuccess] = useState(false);
  const { showToast } = useToast();

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimulatedSuccess(false);

    setTimeout(() => {
      setIsSimulating(false);
      setSimulatedSuccess(true);
      showToast('Validation simulée avec succès en Sandbox !', 'success');
      setTimeout(() => setSimulatedSuccess(false), 3500);
    }, 1100);
  };

  return (
    <section className="pf-section pf-section-alt">
      <div className="pf-container">
        <ScrollReveal duration={800} direction="up">
          <div className="pf-section-header">
            <div className="pf-section-badge">EXPÉRIENCE DE PAIEMENT</div>
            <h2 className="pf-section-title">
              Une expérience de paiement pensée pour vos clients.
            </h2>
            <p className="pf-section-desc">
              Un checkout épuré, adapté aux habitudes mobiles et bancaires locales, avec confirmation instantanée par notification push USSD ou 3DS.
            </p>
          </div>
        </ScrollReveal>

        {/* Lightweight, responsive Checkout Preview Card */}
        <ScrollReveal duration={850} delay={180} direction="up" distance="32px">
          <div className="pf-checkout-preview-wrapper">
          <div className="pf-checkout-preview-card">
            {/* Top Bar */}
            <div className="pf-preview-topbar">
              <div className="pf-preview-merchant">
                <div className="pf-preview-merchant-avatar">C</div>
                <div>
                  <div className="pf-preview-merchant-name">Cardix Store</div>
                  <div className="pf-preview-order-ref">Commande #1024 · Bénin</div>
                </div>
              </div>

              <div className="pf-preview-amount-box">
                <span className="pf-preview-amount-label">À régler</span>
                <span className="pf-preview-amount-value">15 000 XOF</span>
              </div>
            </div>

            {/* Methods & Payment action */}
            <form onSubmit={handleSimulatePayment} className="pf-preview-body">
              <div className="pf-preview-methods-selector">
                <div
                  onClick={() => setSelectedMethod('mtn')}
                  className={`pf-preview-method-item ${selectedMethod === 'mtn' ? 'active' : ''}`}
                >
                  <FontAwesomeIcon icon={faMobileScreen} />
                  <div>
                    <strong>MTN MoMo</strong>
                    <span>Bénin (+229)</span>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedMethod('moov')}
                  className={`pf-preview-method-item ${selectedMethod === 'moov' ? 'active' : ''}`}
                >
                  <FontAwesomeIcon icon={faMobileScreen} />
                  <div>
                    <strong>Moov Money</strong>
                    <span>Moov Africa</span>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedMethod('card')}
                  className={`pf-preview-method-item ${selectedMethod === 'card' ? 'active' : ''}`}
                >
                  <FontAwesomeIcon icon={faCreditCard} />
                  <div>
                    <strong>Carte Visa</strong>
                    <span>Bancaire</span>
                  </div>
                </div>
              </div>

              {selectedMethod !== 'card' ? (
                <div className="pf-preview-input-group">
                  <label className="pf-label">Numéro Mobile Money du payeur</label>
                  <div className="pf-input-wrapper">
                    <span className="pf-input-icon">
                      <FontAwesomeIcon icon={faMobileScreen} />
                    </span>
                    <input
                      type="text"
                      className="pf-input pf-input-with-icon"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="97 00 11 22"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="pf-preview-input-group">
                  <label className="pf-label">Numéro de carte sécurisé</label>
                  <div className="pf-input-wrapper">
                    <span className="pf-input-icon">
                      <FontAwesomeIcon icon={faCreditCard} />
                    </span>
                    <input
                      type="text"
                      className="pf-input pf-input-with-icon"
                      defaultValue="4242 •••• •••• 4242"
                      disabled
                    />
                  </div>
                </div>
              )}

              {simulatedSuccess && (
                <div className="pf-preview-success-alert">
                  <FontAwesomeIcon icon={faCircleCheck} />
                  <span>Paiement validé avec succès en mode Sandbox !</span>
                </div>
              )}

              <div className="pf-preview-actions-row">
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="pf-btn pf-btn-primary pf-btn-lg pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  {isSimulating ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Confirmation en cours...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faLock} />
                      <span>Payer 15 000 XOF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="pf-btn pf-btn-secondary pf-btn-lg"
                >
                  Tester en plein écran
                </button>
              </div>

              <div className="pf-preview-security-note">
                <FontAwesomeIcon icon={faShieldHalved} style={{ color: 'var(--pf-primary)' }} />
                <span>Paiement sécurisé et chiffré par PichFlow</span>
              </div>
            </form>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
};
