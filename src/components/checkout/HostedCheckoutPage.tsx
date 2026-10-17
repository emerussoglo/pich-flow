'use client';

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCheck,
  faCircleXmark,
  faLock,
  faMobileScreen,
  faRotate,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { apiClient } from '../../lib/api';

interface HostedCheckoutPageProps {
  onBack: () => void;
  initialAmount?: number;
  initialTitle?: string;
  paymentLinkSlug?: string;
}

type CheckoutStatus = 'idle' | 'loading' | 'pending' | 'success' | 'failed';

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('fr-FR').format(amount);

export const HostedCheckoutPage: React.FC<HostedCheckoutPageProps> = ({
  onBack,
  initialTitle = 'Paiement',
  paymentLinkSlug,
}) => {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('Pitchflow');
  const [amount, setAmount] = useState(0);
  const [isFixedAmount, setIsFixedAmount] = useState(true);
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState('');
  const [isLoadingLink, setIsLoadingLink] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = paymentLinkSlug || params.get('slug') || params.get('link') || '';
    const reference = params.get('ref') || '';
    if (slug) setActiveSlug(slug);
    if (reference && /^pf_[0-9a-f-]{36}$/i.test(reference)) {
      setTransactionRef(reference);
      setStatus('pending');
    }
    if (!slug) {
      setIsLoadingLink(false);
      return;
    }

    let mounted = true;
    apiClient.paymentLinks.getBySlug(slug).then((result) => {
      if (!mounted) return;
      if (!result.success || !result.paymentLink) {
        setErrorMessage('Ce lien de paiement est introuvable ou indisponible.');
        return;
      }
      const link = result.paymentLink;
      setPaymentLinkId(link.id);
      setTitle(link.title);
      setDescription(link.description || '');
      setMerchantName(link.merchantName || 'Marchand Pitchflow');
      setIsFixedAmount(link.isFixedAmount);
      setAmount(link.isFixedAmount && typeof link.amount === 'number' ? link.amount : 0);
      if (link.currency !== 'XOF') {
        setErrorMessage('Ce lien utilise une devise qui n’est pas disponible avec le checkout PayDunya actuel.');
      }
    }).catch((error: unknown) => {
      if (mounted) {
        setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger le lien de paiement.');
      }
    }).finally(() => {
      if (mounted) setIsLoadingLink(false);
    });
    return () => {
      mounted = false;
    };
  }, [paymentLinkSlug]);

  const refreshStatus = async (reference: string) => {
    const result = await apiClient.checkout.getStatus(reference);
    if (Number.isSafeInteger(result.amount) && result.amount > 0) setAmount(result.amount);
    if (result.status === 'success') {
      setStatus('success');
      setErrorMessage('');
      return true;
    }
    if (result.status === 'failed' || result.status === 'cancelled') {
      setStatus('failed');
      setErrorMessage(result.status === 'cancelled'
        ? 'Le paiement a été annulé.'
        : 'La transaction a été rejetée par PayDunya.');
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (status !== 'pending' || !transactionRef) return;
    let mounted = true;
    const interval = setInterval(() => {
      void refreshStatus(transactionRef).then((isFinal) => {
        if (isFinal) clearInterval(interval);
      }).catch((error: unknown) => {
        if (mounted) {
          setErrorMessage(error instanceof Error
            ? error.message
            : 'La vérification du paiement est temporairement indisponible.');
        }
      });
    }, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [status, transactionRef]);

  const handlePay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    const email = customerEmail.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (!paymentLinkId || !activeSlug) {
      setErrorMessage('Le paiement doit être initié depuis un lien Pitchflow actif.');
      return;
    }
    if (!firstName.trim() || !lastName.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phoneDigits.length !== 8) {
      setErrorMessage('Renseignez votre prénom, votre nom, un e-mail valide et un numéro béninois à 8 chiffres.');
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setErrorMessage('Veuillez renseigner un montant entier positif en XOF.');
      return;
    }

    setStatus('loading');
    try {
      const result = await apiClient.checkout.initiate({
        amount,
        currency: 'XOF',
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        customerEmail: email,
        customerPhone: `+229${phoneDigits}`,
        paymentLinkId,
        paymentLinkSlug: activeSlug,
      });
      const invoiceUrl = new URL(result.invoiceUrl);
      if (invoiceUrl.protocol !== 'https:' ||
          (invoiceUrl.hostname !== 'paydunya.com' && !invoiceUrl.hostname.endsWith('.paydunya.com'))) {
        throw new Error('PayDunya a retourné une URL de paiement non valide.');
      }
      if (!result.reference) throw new Error('La référence de transaction est manquante.');
      setTransactionRef(result.reference);
      setStatus('pending');
      window.location.assign(invoiceUrl.toString());
    } catch (error: unknown) {
      setStatus('failed');
      setErrorMessage(error instanceof Error
        ? error.message
        : 'Échec de l’initiation du paiement PayDunya.');
    }
  };

  const handleManualCheckStatus = async () => {
    if (!transactionRef) return;
    setIsCheckingStatus(true);
    setErrorMessage('');
    try {
      const isFinal = await refreshStatus(transactionRef);
      if (!isFinal) setErrorMessage('Le paiement est toujours en attente de confirmation par PayDunya.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error
        ? error.message
        : 'Impossible de vérifier le statut du paiement.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setTransactionRef('');
    setErrorMessage('');
  };

  return (
    <div className="pf-ui-checkout-page">
      <div className="pf-ui-checkout-card">
        <button onClick={onBack} className="pf-ui-back-link" type="button">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Retour</span>
        </button>

        {status === 'idle' && (
          <form onSubmit={handlePay}>
            <div className="pf-ui-header-fixed">
              <div className="pf-ui-header-left">
                <div className="pf-ui-avatar-badge">{merchantName.charAt(0).toUpperCase()}</div>
                <div className="pf-ui-header-titles">
                  <div className="pf-ui-header-title">{title}</div>
                  <div className="pf-ui-header-sub">{merchantName}</div>
                </div>
              </div>
              {isFixedAmount && (
                <div className="pf-ui-header-price">{formatAmount(amount)} XOF</div>
              )}
            </div>

            {description && <p className="pf-ui-pending-sub">{description}</p>}

            {!isFixedAmount && (
              <div className="pf-ui-form-group">
                <label className="pf-ui-label" htmlFor="checkout-amount">Montant (XOF) *</label>
                <input
                  id="checkout-amount"
                  type="number"
                  className="pf-ui-input"
                  min="1"
                  step="1"
                  value={amount || ''}
                  onChange={(event) => setAmount(event.target.value === '' ? 0 : Number(event.target.value))}
                  required
                />
              </div>
            )}

            <div className="pf-ui-form-group">
              <label className="pf-ui-label">Pays</label>
              <div className="pf-ui-input" aria-readonly="true">Bénin (+229) — XOF</div>
              <p className="pf-ui-notice-chip">
                Choisissez votre moyen de paiement sur la page sécurisée de PayDunya.
              </p>
            </div>

            <div className="pf-ui-form-row">
              <div>
                <label className="pf-ui-label" htmlFor="checkout-first-name">Prénom *</label>
                <input
                  id="checkout-first-name"
                  type="text"
                  className="pf-ui-input"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div>
                <label className="pf-ui-label" htmlFor="checkout-last-name">Nom *</label>
                <input
                  id="checkout-last-name"
                  type="text"
                  className="pf-ui-input"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div className="pf-ui-form-group">
              <label className="pf-ui-label" htmlFor="checkout-email">Adresse e-mail *</label>
              <input
                id="checkout-email"
                type="email"
                className="pf-ui-input"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="pf-ui-form-group">
              <label className="pf-ui-label" htmlFor="checkout-phone">Téléphone *</label>
              <div className="pf-ui-phone-row">
                <span className="pf-ui-phone-icon"><FontAwesomeIcon icon={faMobileScreen} /></span>
                <span className="pf-ui-phone-code">+229</span>
                <div className="pf-ui-phone-divider" />
                <input
                  id="checkout-phone"
                  type="tel"
                  className="pf-ui-phone-input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="97 00 12 34"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  pattern="[0-9 ()-]{8,14}"
                  required
                />
              </div>
            </div>

            <div className="pf-ui-summary-box">
              <div className="pf-ui-summary-row">
                <span>Montant</span>
                <span>{formatAmount(amount)} XOF</span>
              </div>
              <div className="pf-ui-summary-divider" />
              <div className="pf-ui-summary-total">
                <span>Total à payer</span>
                <span>{formatAmount(amount)} XOF</span>
              </div>
            </div>

            {errorMessage && <p role="alert" className="pf-ui-failed-sub">{errorMessage}</p>}
            <button type="submit" className="pf-ui-submit-btn" disabled={isLoadingLink || !paymentLinkId}>
              <span>{isLoadingLink ? 'Chargement du lien...' : `Payer ${formatAmount(amount)} XOF`}</span>
            </button>
          </form>
        )}

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div className="pf-ui-pending-icon-wrap">
              <div className="pf-ui-spinner-arc" />
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
            <div className="pf-ui-pending-title">Préparation sécurisée du paiement</div>
            <div className="pf-ui-pending-sub">Connexion à PayDunya...</div>
          </div>
        )}

        {status === 'pending' && (
          <div className="pf-ui-pending-view">
            <div className="pf-ui-pending-icon-wrap">
              <div className="pf-ui-spinner-arc" />
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
            <div className="pf-ui-pending-title">Confirmation PayDunya en cours</div>
            <div className="pf-ui-pending-sub">
              Le statut affiché sera mis à jour après confirmation côté serveur. Référence : {transactionRef}
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
              {errorMessage && <p role="alert" className="pf-ui-failed-sub">{errorMessage}</p>}
              <button
                type="button"
                onClick={handleManualCheckStatus}
                disabled={isCheckingStatus}
                className="pf-ui-retry-btn"
              >
                <FontAwesomeIcon icon={faRotate} spin={isCheckingStatus} style={{ marginRight: '0.4rem' }} />
                <span>{isCheckingStatus ? 'Vérification...' : 'Actualiser le statut'}</span>
              </button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="pf-ui-failed-view">
            <div style={{ fontSize: '1.85rem', color: '#EF4444' }}>
              <FontAwesomeIcon icon={faCircleXmark} />
            </div>
            <div className="pf-ui-failed-title">Paiement non confirmé</div>
            <div className="pf-ui-failed-sub">
              {errorMessage || 'PayDunya n’a pas confirmé le paiement.'}
            </div>
            <button type="button" onClick={handleReset} className="pf-ui-retry-btn">
              Réessayer
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="pf-ui-success-view">
            <div className="pf-ui-success-icon-wrap"><FontAwesomeIcon icon={faCheck} /></div>
            <div className="pf-ui-success-title">Paiement confirmé</div>
            <div className="pf-ui-success-sub">
              PayDunya a confirmé le paiement de {formatAmount(amount)} XOF.
            </div>
            <div className="pf-ui-receipt-box">
              <div className="pf-ui-receipt-row">
                <span className="pf-ui-receipt-lbl">Référence</span>
                <span className="pf-ui-receipt-val">{transactionRef}</span>
              </div>
              <div className="pf-ui-receipt-row">
                <span className="pf-ui-receipt-lbl">Montant confirmé</span>
                <span className="pf-ui-receipt-val">{formatAmount(amount)} XOF</span>
              </div>
            </div>
          </div>
        )}

        <div className="pf-ui-watermark">
          <span className="pf-ui-watermark-lock"><FontAwesomeIcon icon={faLock} /></span>
          <span>Paiement sécurisé par</span>
          <span className="pf-ui-watermark-brand">
            <span className="pf-ui-watermark-icon">⚡</span>
            Pitchflow
          </span>
        </div>
      </div>
    </div>
  );
};
