import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faCircleCheck,
  faCircleXmark,
  faLock,
  faRotate,
  faShieldHalved,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { apiClient } from '../../lib/api';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '../../config/payments';
import { SUPPORTED_COUNTRIES } from '../../config/countries';

interface HostedCheckoutPageProps {
  onBack: () => void;
  initialAmount?: number;
  initialTitle?: string;
  paymentLinkSlug?: string;
}

type CheckoutStatus = 'idle' | 'loading' | 'pending' | 'success' | 'failed';

const PAYDUNYA_COUNTRIES = SUPPORTED_COUNTRIES
  .filter((country) => country.code === 'BJ')
  .map(({ code, name, flag, dialCode, currency }) => ({ code, name, flag, dialCode, currency }));

export const HostedCheckoutPage: React.FC<HostedCheckoutPageProps> = ({
  onBack,
  initialAmount = 0,
  initialTitle = '',
  paymentLinkSlug,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('BJ');
  const [countrySearch, setCountrySearch] = useState('');
  const [isFixedAmount, setIsFixedAmount] = useState(true);
  const [amount, setAmount] = useState(initialAmount);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('Marchand');
  const [currency, setCurrency] = useState('XOF');
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [isLinkLoading, setIsLinkLoading] = useState(Boolean(paymentLinkSlug));
  const [linkError, setLinkError] = useState('');
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [transactionRef, setTransactionRef] = useState('');
  const [paydunyaInvoiceUrl, setPaydunyaInvoiceUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const submitLock = useRef(false);
  const selectedCountry = PAYDUNYA_COUNTRIES.find((country) => country.code === selectedCountryCode);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const slug = paymentLinkSlug || query.get('slug') || query.get('link');
    if (!slug) {
      setIsLinkLoading(false);
      setLinkError('Ce parcours de paiement nécessite un lien PichFlow valide.');
      return;
    }

    let active = true;
    apiClient.paymentLinks.getBySlug(slug)
      .then((result) => {
        if (!active) return;
        if (!result.success || !result.paymentLink) {
          setLinkError('Ce lien de paiement est introuvable ou inactif.');
          return;
        }
        const link = result.paymentLink;
        setPaymentLinkId(String(link.id));
        setTitle(String(link.title || 'Paiement'));
        setDescription(String(link.description || ''));
        setMerchantName(String(link.merchantName || 'Marchand'));
        setCurrency(String(link.currency || 'XOF'));
        setIsFixedAmount(link.isFixedAmount !== false);
        if (link.amount !== undefined && link.amount !== null) setAmount(Number(link.amount));
        const configuredCountry = PAYDUNYA_COUNTRIES.find((country) => country.code === link.country);
        if (configuredCountry) setSelectedCountryCode(configuredCountry.code);
        else setLinkError('Ce lien utilise un pays qui n’est pas disponible dans la configuration PayDunya vérifiée.');
      })
      .catch(() => {
        if (active) setLinkError('Impossible de charger ce lien de paiement. Réessayez plus tard.');
      })
      .finally(() => {
        if (active) setIsLinkLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paymentLinkSlug]);

  const checkStatus = useCallback(async (reference: string, manual = false) => {
    if (manual) setIsCheckingStatus(true);
    try {
      const result = manual
        ? await apiClient.checkout.confirm({ reference })
        : await apiClient.checkout.getStatus(reference);
      if (result.status === 'success' || result.status === 'completed') {
        setStatus('success');
        setErrorMessage('');
      } else if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'canceled') {
        setStatus('failed');
        setErrorMessage('PayDunya a confirmé que le paiement a été annulé ou refusé.');
      } else if (manual) {
        setErrorMessage('Paiement en cours de confirmation auprès de PayDunya.');
      }
    } catch (error) {
      if (manual) {
        setErrorMessage(error instanceof Error ? error.message : 'Impossible de vérifier le paiement.');
      }
    } finally {
      if (manual) setIsCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const reference = query.get('ref');
    if (!reference) return;
    setTransactionRef(reference);
    setStatus('pending');
    void checkStatus(reference, true);
  }, [checkStatus]);

  useEffect(() => {
    if (status !== 'pending' || !transactionRef) return;
    const interval = window.setInterval(() => {
      void checkStatus(transactionRef);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [checkStatus, status, transactionRef]);

  const validateCustomer = (): boolean => {
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Veuillez saisir votre prénom et votre nom.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setErrorMessage('Veuillez saisir une adresse e-mail valide.');
      return false;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setErrorMessage('Veuillez saisir un numéro de téléphone valide.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const continueToNextStep = () => {
    if (step === 1) {
      if (validateCustomer()) setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedCountry) {
        setErrorMessage('Sélectionnez un pays pris en charge.');
        return;
      }
      setErrorMessage('');
      setStep(3);
    }
  };

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current || isLinkLoading || linkError || !paymentLinkId) return;
    if (!validateCustomer()) {
      setStep(1);
      return;
    }
    if (!Number.isSafeInteger(amount) || amount < PAYDUNYA_MINIMUM_AMOUNT_XOF) {
      setErrorMessage(`Saisissez un montant XOF entier d’au moins ${PAYDUNYA_MINIMUM_AMOUNT_XOF}.`);
      return;
    }

    submitLock.current = true;
    setStatus('loading');
    setErrorMessage('');
    try {
      const query = new URLSearchParams(window.location.search);
      const slug = paymentLinkSlug || query.get('slug') || query.get('link') || '';
      const result = await apiClient.checkout.initiate({
        paymentLinkId,
        paymentLinkSlug: slug,
        amount: isFixedAmount ? undefined : amount,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        customerEmail: customerEmail.trim(),
        customerPhone: `${selectedCountry?.dialCode || ''}${phone.replace(/\s/g, '')}`,
      }, window.crypto.randomUUID());
      setTransactionRef(result.reference);
      setPaydunyaInvoiceUrl(result.invoiceUrl);
      setStatus('pending');
      if (result.invoiceUrl) window.location.assign(result.invoiceUrl);
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Échec de la création de la facture PayDunya.');
    } finally {
      submitLock.current = false;
    }
  };

  const resetAfterFailure = () => {
    setStatus('idle');
    setErrorMessage('');
    setPaydunyaInvoiceUrl('');
    setTransactionRef('');
    setStep(3);
  };

  const formatAmount = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
  const visibleCountries = PAYDUNYA_COUNTRIES.filter((country) =>
    `${country.name} ${country.code}`.toLowerCase().includes(countrySearch.trim().toLowerCase()),
  );

  return (
    <main className="pf-saspay-checkout-page">
      <section className="pf-saspay-checkout-card" aria-label="Paiement sécurisé PichFlow">
        <button onClick={onBack} className="pf-saspay-back-link" type="button">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Retour</span>
        </button>

        {status === 'idle' && (
          <>
            {isLinkLoading ? (
              <p role="status">Chargement du lien de paiement…</p>
            ) : linkError ? (
              <div role="alert" className="pf-saspay-failed-view">{linkError}</div>
            ) : (
              <form onSubmit={handlePay}>
                <header className="pf-saspay-header-fixed">
                  <div className="pf-saspay-header-left">
                    <div className="pf-saspay-avatar-badge">{merchantName.charAt(0).toUpperCase()}</div>
                    <div className="pf-saspay-header-titles">
                      <div className="pf-saspay-header-title">{title}</div>
                      <div className="pf-saspay-header-sub">{merchantName}</div>
                    </div>
                  </div>
                  {isFixedAmount && (
                    <div className="pf-saspay-header-price">{formatAmount(amount)} {currency}</div>
                  )}
                </header>
                {description && <p className="pf-saspay-pending-sub">{description}</p>}

                <nav aria-label="Étapes du paiement" style={{ display: 'flex', gap: 8, margin: '1.25rem 0' }}>
                  {['Vos informations', 'Pays et paiement', 'Confirmation'].map((label, index) => (
                    <div key={label} aria-current={step === index + 1 ? 'step' : undefined} style={{
                      flex: 1, padding: '0.65rem 0.4rem', borderRadius: 10, textAlign: 'center',
                      color: step === index + 1 ? '#5E30E8' : '#64748B',
                      background: step === index + 1 ? '#F3F0FF' : '#F8FAFC',
                      fontSize: '0.78rem', fontWeight: 700,
                    }}>
                      {index + 1}. {label}
                    </div>
                  ))}
                </nav>

                {step === 1 && (
                  <section aria-labelledby="checkout-customer-title">
                    <h1 id="checkout-customer-title">Informations du client</h1>
                    <div className="pf-saspay-form-row">
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Prénom *</span>
                        <input className="pf-saspay-input" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                      </label>
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Nom *</span>
                        <input className="pf-saspay-input" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
                      </label>
                    </div>
                    <label className="pf-saspay-form-group">
                      <span className="pf-saspay-label">Adresse e-mail *</span>
                      <input className="pf-saspay-input" type="email" autoComplete="email" required value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                    </label>
                    <label className="pf-saspay-form-group">
                      <span className="pf-saspay-label">Numéro de téléphone *</span>
                      <div className="pf-saspay-phone-row">
                        <span className="pf-saspay-phone-code">{selectedCountry?.dialCode || '+229'}</span>
                        <input className="pf-saspay-phone-input" type="tel" autoComplete="tel-national" required value={phone} onChange={(event) => setPhone(event.target.value)} />
                      </div>
                    </label>
                  </section>
                )}

                {step === 2 && (
                  <section aria-labelledby="checkout-country-title">
                    <h1 id="checkout-country-title">Pays et moyen de paiement</h1>
                    <label className="pf-saspay-form-group">
                      <span className="pf-saspay-label">Rechercher un pays</span>
                      <input className="pf-saspay-input" type="search" value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Rechercher un pays" />
                    </label>
                    <div role="listbox" aria-label="Pays pris en charge">
                      {visibleCountries.map((country) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedCountryCode === country.code}
                          key={country.code}
                          onClick={() => setSelectedCountryCode(country.code)}
                          className="pf-saspay-method-card"
                        >
                          <span aria-hidden="true">{country.flag}</span>
                          <span>{country.name} ({country.code})</span>
                          <span>{country.currency}</span>
                        </button>
                      ))}
                      {visibleCountries.length === 0 && <p>Aucun pays vérifié ne correspond à votre recherche.</p>}
                    </div>
                    <div className="pf-saspay-notice-chip" style={{ marginTop: 16 }}>
                      <FontAwesomeIcon icon={faShieldHalved} /> Les moyens réellement activés pour votre compte sont affichés et collectés sur la page sécurisée PayDunya. PichFlow ne propose aucun mode non vérifié.
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="checkout-confirm-title">
                    <h1 id="checkout-confirm-title">Confirmer et payer</h1>
                    {!isFixedAmount && (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Montant à payer ({currency}) *</span>
                        <input
                          className="pf-saspay-input"
                          type="number"
                          min={PAYDUNYA_MINIMUM_AMOUNT_XOF}
                          step="1"
                          required
                          value={amount || ''}
                          onChange={(event) => setAmount(Number(event.target.value))}
                        />
                      </label>
                    )}
                    <div className="pf-saspay-summary-box">
                      <div className="pf-saspay-summary-row"><span>Produit</span><strong>{title}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Pays</span><strong>{selectedCountry?.flag} {selectedCountry?.name}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Client</span><strong>{firstName} {lastName}</strong></div>
                      <div className="pf-saspay-summary-row"><span>E-mail</span><strong>{customerEmail}</strong></div>
                      <div className="pf-saspay-summary-divider" />
                      <div className="pf-saspay-summary-total">
                        <span>Montant à payer</span><span>{formatAmount(amount)} {currency}</span>
                      </div>
                      <small>Les frais éventuels du prestataire ne sont pas ajoutés par PichFlow.</small>
                    </div>
                  </section>
                )}

                {errorMessage && <p role="alert" className="pf-saspay-failed-sub">{errorMessage}</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  {step > 1 && (
                    <button type="button" className="pf-saspay-retry-btn" onClick={() => { setErrorMessage(''); setStep((step - 1) as 1 | 2); }}>
                      <FontAwesomeIcon icon={faArrowLeft} /> Retour
                    </button>
                  )}
                  {step < 3 ? (
                    <button type="button" className="pf-saspay-submit-btn" onClick={continueToNextStep}>
                      Continuer <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  ) : (
                    <button type="submit" className="pf-saspay-submit-btn" disabled={isLinkLoading || !paymentLinkId}>
                      <FontAwesomeIcon icon={faLock} /> Payer {formatAmount(amount)} {currency}
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        )}

        {status === 'loading' && (
          <div role="status" aria-live="polite" className="pf-saspay-pending-view">
            <FontAwesomeIcon icon={faSpinner} spin />
            <h1>Préparation de la facture PayDunya…</h1>
            <p>Ne fermez pas cette page. Vous allez être redirigé vers le paiement sécurisé.</p>
          </div>
        )}

        {status === 'pending' && (
          <div className="pf-saspay-pending-view">
            <FontAwesomeIcon icon={faSpinner} spin />
            <h1>Paiement en cours de confirmation</h1>
            <p>PayDunya vérifie la transaction auprès du moyen de paiement.</p>
            {errorMessage && <p role="alert">{errorMessage}</p>}
            {paydunyaInvoiceUrl && (
              <a href={paydunyaInvoiceUrl} className="pf-saspay-submit-btn">
                Continuer sur PayDunya <FontAwesomeIcon icon={faArrowRight} />
              </a>
            )}
            <button type="button" className="pf-saspay-retry-btn" disabled={isCheckingStatus} onClick={() => void checkStatus(transactionRef, true)}>
              <FontAwesomeIcon icon={faRotate} spin={isCheckingStatus} /> Vérifier le statut
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="pf-saspay-failed-view">
            <FontAwesomeIcon icon={faCircleXmark} />
            <h1>Paiement non confirmé</h1>
            <p>{errorMessage || 'La transaction a été annulée ou refusée par PayDunya.'}</p>
            <button type="button" className="pf-saspay-retry-btn" onClick={resetAfterFailure}>Recommencer</button>
          </div>
        )}

        {status === 'success' && (
          <div className="pf-saspay-success-view">
            <FontAwesomeIcon icon={faCircleCheck} />
            <h1>Paiement confirmé</h1>
            <p>PayDunya a confirmé le paiement de {formatAmount(amount)} {currency} pour {title}.</p>
            <p>Référence : <strong>{transactionRef}</strong></p>
            <p>Les frais et le montant net ne sont pas confirmés par les données actuellement renvoyées par PayDunya.</p>
            <button type="button" onClick={onBack} className="pf-saspay-submit-btn">
              Terminer <FontAwesomeIcon icon={faCheck} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
