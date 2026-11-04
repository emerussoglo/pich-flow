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
import {
  CHECKOUT_COUNTRIES,
  filterCountriesBySearch,
  getPaymentMethodsForCountryAndCurrency,
  normalizePaymentPhone,
  SUPPORTED_PAYMENT_CURRENCIES,
} from '../../config/countries';

interface HostedCheckoutPageProps {
  onBack: () => void;
  initialAmount?: number;
  initialTitle?: string;
  paymentLinkSlug?: string;
}

type CheckoutStatus = 'idle' | 'loading' | 'pending' | 'success' | 'failed' | 'cancelled';

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
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentOtp, setPaymentOtp] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [isFixedAmount, setIsFixedAmount] = useState(true);
  const [amount, setAmount] = useState(initialAmount);
  const [minimumAmount, setMinimumAmount] = useState<number | null>(null);
  const [maximumAmount, setMaximumAmount] = useState<number | null>(null);
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
  const [pendingMessage, setPendingMessage] = useState('');
  const [requiresAuthorizationCode, setRequiresAuthorizationCode] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [isConfirmingAuthorization, setIsConfirmingAuthorization] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const submitLock = useRef(false);
  const availableCountries = CHECKOUT_COUNTRIES.filter(
    (country) => country.currency === currency || country.code === 'INT',
  );
  const selectedCountry = availableCountries.find((country) => country.code === selectedCountryCode);
  const selectedMethods = selectedCountry
    ? getPaymentMethodsForCountryAndCurrency(selectedCountry.code, currency)
    : [];
  const selectedMethod = selectedMethods.find((method) => method.id === selectedMethodId);
  const providerMinimumAmount = SUPPORTED_PAYMENT_CURRENCIES.find((supported) => supported.code === currency)?.minimumAmount
    ?? PAYDUNYA_MINIMUM_AMOUNT_XOF;

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
        setMinimumAmount(link.minAmount === undefined || link.minAmount === null ? null : Number(link.minAmount));
        setMaximumAmount(link.maxAmount === undefined || link.maxAmount === null ? null : Number(link.maxAmount));
        if (link.amount !== undefined && link.amount !== null) setAmount(Number(link.amount));
        if (
          link.isFixedAmount === false &&
          (!Number.isSafeInteger(Number(link.minAmount)) || !Number.isSafeInteger(Number(link.maxAmount)))
        ) {
          setLinkError('Les limites de montant de ce lien doivent être configurées par le marchand avant le paiement.');
        }
        const configuredCountry = CHECKOUT_COUNTRIES.find(
          (country) => country.code === link.country &&
            (country.currency === link.currency || country.code === 'INT'),
        );
        if (configuredCountry) setSelectedCountryCode(configuredCountry.code);
        else if (link.country) setLinkError('Ce lien utilise un pays qui n’est pas disponible dans la configuration de paiement vérifiée.');
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
        setRequiresAuthorizationCode(false);
        setErrorMessage('');
      } else if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'canceled') {
        setStatus(result.status === 'failed' ? 'failed' : 'cancelled');
        setRequiresAuthorizationCode(false);
        setErrorMessage(result.status === 'failed'
          ? 'Le paiement a été refusé.'
          : 'Le paiement a été annulé.');
      } else {
        setRequiresAuthorizationCode(Boolean(result.requiresAuthorizationCode));
        if (manual) setErrorMessage('Paiement en cours de confirmation.');
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
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) {
      setErrorMessage('Veuillez saisir un numéro de téléphone valide.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateAmount = (): boolean => {
    if (!Number.isSafeInteger(amount) || amount < providerMinimumAmount) {
      setErrorMessage(`Saisissez un montant ${currency} entier d’au moins ${providerMinimumAmount}.`);
      return false;
    }
    if (
      !isFixedAmount &&
      (minimumAmount === null || maximumAmount === null ||
        amount < minimumAmount || amount > maximumAmount)
    ) {
      setErrorMessage(`Le montant doit être compris entre ${minimumAmount} et ${maximumAmount} ${currency}.`);
      return false;
    }
    return true;
  };

  const validatePaymentDetails = (): boolean => {
    if (!selectedCountry || !selectedMethod) {
      setErrorMessage('Sélectionnez un pays et un moyen de paiement.');
      return false;
    }
    if (selectedMethod.phoneLength) {
      const normalizedPhone = normalizePaymentPhone(paymentPhone, selectedCountry.code);
      if (!new RegExp(`^\\d{${selectedMethod.phoneLength}}$`).test(normalizedPhone)) {
        setErrorMessage(`Saisissez un numéro de ${selectedMethod.phoneLength} chiffres pour ${selectedMethod.name}.`);
        return false;
      }
    }
    if (
      (selectedMethod.input === 'orange-ci-otp' || selectedMethod.input === 'orange-bf-otp') &&
      !/^\d{4,8}$/.test(paymentOtp.replace(/\D/g, ''))
    ) {
      setErrorMessage('Saisissez le code de paiement reçu pour cet opérateur.');
      return false;
    }
    if (selectedMethod.input === 'customer-address' && customerAddress.trim().length < 2) {
      setErrorMessage('Saisissez votre adresse pour ce moyen de paiement.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const continueToNextStep = () => {
    if (step === 1) {
      if (validateCustomer() && validateAmount()) setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedCountry || !selectedMethod) {
        setErrorMessage('Sélectionnez un pays et un moyen de paiement.');
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
    if (!validatePaymentDetails()) return;
    if (!validateAmount()) {
      setStep(1);
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
        customerPhone: phone.trim(),
        paymentMethod: selectedMethodId,
        paymentPhone: selectedMethod?.phoneLength ? normalizePaymentPhone(paymentPhone, selectedCountryCode) : '',
        paymentOtp: paymentOtp.trim(),
        customerAddress: customerAddress.trim(),
        country: selectedCountryCode,
      }, window.crypto.randomUUID());
      setTransactionRef(result.reference);
      setPaydunyaInvoiceUrl(result.redirectUrl || '');
      setPendingMessage(result.message || 'Paiement en attente de confirmation.');
      setRequiresAuthorizationCode(Boolean(result.requiresAuthorizationCode));
      setStatus('pending');
      if (result.redirectUrl) window.location.assign(result.redirectUrl);
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de préparer le paiement sécurisé.');
    } finally {
      submitLock.current = false;
    }
  };

  const resetAfterFailure = () => {
    setStatus('idle');
    setErrorMessage('');
    setPaydunyaInvoiceUrl('');
    setTransactionRef('');
    setAuthorizationCode('');
    setRequiresAuthorizationCode(false);
    setStep(3);
  };

  const submitWizallAuthorization = async () => {
    if (!transactionRef || !/^\d{4,8}$/.test(authorizationCode.trim())) {
      setErrorMessage('Saisissez le code de confirmation reçu de Wizall.');
      return;
    }
    setIsConfirmingAuthorization(true);
    setErrorMessage('');
    try {
      const result = await apiClient.checkout.confirm({
        reference: transactionRef,
        authorizationCode: authorizationCode.trim(),
      });
      setPendingMessage(result.message || 'Code transmis. Vérification du paiement en cours.');
      setRequiresAuthorizationCode(Boolean(result.requiresAuthorizationCode));
      if (result.status === 'success' || result.status === 'completed') {
        setStatus('success');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de confirmer le code Wizall.');
    } finally {
      setIsConfirmingAuthorization(false);
    }
  };

  const formatAmount = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
  const visibleCountries = filterCountriesBySearch(availableCountries, countrySearch);

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
                  {['Vos informations', 'Pays et paiement', 'Numéro et confirmation'].map((label, index) => (
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
                    {!isFixedAmount ? (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Montant ({currency}) *</span>
                        <input
                          className="pf-saspay-input"
                          type="number"
                          min={minimumAmount ?? providerMinimumAmount}
                          max={maximumAmount ?? undefined}
                          step="1"
                          required
                          value={amount || ''}
                          onChange={(event) => {
                            setAmount(Number(event.target.value));
                            setErrorMessage('');
                          }}
                        />
                        <small>
                          Montant autorisé : {formatAmount(minimumAmount ?? providerMinimumAmount)} à {formatAmount(maximumAmount ?? 0)} {currency}
                        </small>
                      </label>
                    ) : (
                      <div className="pf-saspay-summary-box" aria-label="Montant fixe du paiement">
                        <div className="pf-saspay-summary-row">
                          <span>Montant fixe</span>
                          <strong>{formatAmount(amount)} {currency}</strong>
                        </div>
                      </div>
                    )}
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
                      <span className="pf-saspay-label">Numéro de téléphone de contact *</span>
                      <div className="pf-saspay-phone-row">
                        <input className="pf-saspay-phone-input" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+229 01 23 45 67" />
                      </div>
                      <small>Le numéro du portefeuille de paiement sera demandé séparément à l’étape suivante.</small>
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
                    <label className="pf-saspay-form-group">
                      <span className="pf-saspay-label">Pays</span>
                      <select
                        className="pf-saspay-select"
                        value={selectedCountryCode}
                        disabled={visibleCountries.length === 0}
                        onChange={(event) => {
                          setSelectedCountryCode(event.target.value);
                          setSelectedMethodId('');
                          setPaymentPhone('');
                          setPaymentOtp('');
                          setCustomerAddress('');
                          setErrorMessage('');
                        }}
                      >
                        <option value="" disabled>Choisir un pays</option>
                        {visibleCountries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name}{country.dialCode ? ` (${country.dialCode})` : ''} · {country.code === 'INT' ? currency : country.currency}
                          </option>
                        ))}
                      </select>
                      {visibleCountries.length === 0 && (
                        <span role="status">Aucun pays de paiement actuellement configuré ne correspond à votre recherche.</span>
                      )}
                    </label>
                    {selectedCountry && (
                      <fieldset className="pf-saspay-form-group" style={{ border: 0, padding: 0, margin: '1rem 0' }}>
                        <legend className="pf-saspay-label">Moyen de paiement</legend>
                        {selectedMethods.map((method) => (
                          <label
                            key={method.id}
                            className="pf-saspay-method-card"
                            style={{ cursor: 'pointer', borderColor: selectedMethodId === method.id ? '#5E30E8' : undefined }}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value={method.id}
                              checked={selectedMethodId === method.id}
                              onChange={() => {
                                setSelectedMethodId(method.id);
                                setPaymentPhone('');
                                setPaymentOtp('');
                                setCustomerAddress('');
                                setErrorMessage('');
                              }}
                            />
                            <span>{method.name}</span>
                            {method.type === 'card' && <small>Checkout sécurisé hébergé par PayDunya</small>}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <div className="pf-saspay-notice-chip" style={{ marginTop: 16 }}>
                      <FontAwesomeIcon icon={faShieldHalved} /> Les canaux affichés suivent la documentation PayDunya. Leur activation sur le compte marchand doit être confirmée auprès de PayDunya. PichFlow ne collecte jamais de code PIN ni de numéro de carte.
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="checkout-confirm-title">
                    <h1 id="checkout-confirm-title">Coordonnées de paiement</h1>
                    {selectedMethod?.phoneLength && selectedCountry && (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Numéro {selectedMethod.name} *</span>
                        <input
                          className="pf-saspay-input"
                          type="tel"
                          autoComplete="tel-national"
                          required
                          value={paymentPhone}
                          onChange={(event) => setPaymentPhone(event.target.value)}
                          placeholder={`${selectedCountry.dialCode} …`}
                        />
                        <small>Entrez le numéro local de {selectedMethod.phoneLength} chiffres, ou son équivalent international.</small>
                      </label>
                    )}
                    {selectedMethod?.input === 'orange-ci-otp' && (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Code de paiement Orange Money *</span>
                        <input className="pf-saspay-input" inputMode="numeric" autoComplete="one-time-code" required value={paymentOtp} onChange={(event) => setPaymentOtp(event.target.value)} />
                        <small>{selectedMethod.instructions}</small>
                      </label>
                    )}
                    {selectedMethod?.input === 'orange-bf-otp' && (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Code de paiement Orange Money *</span>
                        <input className="pf-saspay-input" inputMode="numeric" autoComplete="one-time-code" required value={paymentOtp} onChange={(event) => setPaymentOtp(event.target.value)} />
                        <small>Obtenez le code de paiement Orange Money avant de lancer la transaction.</small>
                      </label>
                    )}
                    {selectedMethod?.input === 'customer-address' && (
                      <label className="pf-saspay-form-group">
                        <span className="pf-saspay-label">Adresse *</span>
                        <input className="pf-saspay-input" autoComplete="street-address" required value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
                      </label>
                    )}
                    {selectedMethod?.type === 'card' && (
                      <p className="pf-saspay-pending-sub">
                        La saisie de la carte et toute étape 3-D Secure se feront sur la page hébergée par PayDunya. PichFlow ne reçoit pas les données de carte.
                      </p>
                    )}
                    <div className="pf-saspay-summary-box">
                      <div className="pf-saspay-summary-row"><span>Produit</span><strong>{title}</strong></div>
                      {description && <div className="pf-saspay-summary-row"><span>Description</span><strong>{description}</strong></div>}
                      <div className="pf-saspay-summary-row"><span>Montant du produit</span><strong>{formatAmount(amount)} {currency}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Pays</span><strong>{selectedCountry?.flag} {selectedCountry?.name}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Moyen de paiement</span><strong>{selectedMethod?.name}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Client</span><strong>{firstName} {lastName}</strong></div>
                      <div className="pf-saspay-summary-row"><span>E-mail</span><strong>{customerEmail}</strong></div>
                      <div className="pf-saspay-summary-row"><span>Téléphone de contact</span><strong>{phone}</strong></div>
                      {paymentPhone && <div className="pf-saspay-summary-row"><span>Téléphone de paiement</span><strong>{paymentPhone}</strong></div>}
                      <div className="pf-saspay-summary-row"><span>Frais fournisseur</span><strong>Non connus avant le paiement</strong></div>
                      <div className="pf-saspay-summary-divider" />
                      <div className="pf-saspay-summary-total">
                        <span>Montant de la facture</span><span>{formatAmount(amount)} {currency}</span>
                      </div>
                      <small>Le checkout sécurisé du fournisseur affichera le montant final et les éventuels frais applicables. PichFlow n’ajoute pas de frais estimés.</small>
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
                    <button type="submit" className="pf-saspay-submit-btn" disabled={isLinkLoading || !paymentLinkId || !selectedMethod}>
                      <FontAwesomeIcon icon={faLock} /> Lancer le paiement · {formatAmount(amount)} {currency}
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
            <h1>Préparation du paiement sécurisé…</h1>
            <p>Ne fermez pas cette page. Vous allez être redirigé vers le paiement sécurisé.</p>
          </div>
        )}

        {status === 'pending' && (
          <div className="pf-saspay-pending-view">
            <FontAwesomeIcon icon={faSpinner} spin />
            <h1>Paiement en cours de confirmation</h1>
            <p>{pendingMessage || 'Nous vérifions la transaction auprès du moyen de paiement.'}</p>
            {requiresAuthorizationCode && (
              <form onSubmit={(event) => { event.preventDefault(); void submitWizallAuthorization(); }}>
                <label className="pf-saspay-form-group">
                  <span className="pf-saspay-label">Code de confirmation Wizall</span>
                  <input
                    className="pf-saspay-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={authorizationCode}
                    onChange={(event) => setAuthorizationCode(event.target.value)}
                  />
                </label>
                <button type="submit" className="pf-saspay-submit-btn" disabled={isConfirmingAuthorization}>
                  {isConfirmingAuthorization ? 'Confirmation…' : 'Confirmer le code'}
                </button>
              </form>
            )}
            {errorMessage && <p role="alert">{errorMessage}</p>}
            {paydunyaInvoiceUrl && (
              <a href={paydunyaInvoiceUrl} className="pf-saspay-submit-btn">
                Continuer vers le paiement sécurisé <FontAwesomeIcon icon={faArrowRight} />
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
            <p>{errorMessage || 'La transaction n’a pas été confirmée.'}</p>
            <button type="button" className="pf-saspay-retry-btn" onClick={resetAfterFailure}>Recommencer</button>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="pf-saspay-failed-view">
            <FontAwesomeIcon icon={faCircleXmark} />
            <h1>Paiement annulé</h1>
            <p>{errorMessage || 'Le paiement a été annulé avant sa confirmation.'}</p>
            <button type="button" className="pf-saspay-retry-btn" onClick={resetAfterFailure}>Recommencer</button>
          </div>
        )}

        {status === 'success' && (
          <div className="pf-saspay-success-view">
            <FontAwesomeIcon icon={faCircleCheck} />
            <h1>Paiement confirmé</h1>
            <p>Le paiement de {formatAmount(amount)} {currency} pour {title} a été confirmé.</p>
            <p>Référence : <strong>{transactionRef}</strong></p>
            <p>Les frais et le montant net ne sont pas confirmés par les informations disponibles.</p>
            <button type="button" onClick={onBack} className="pf-saspay-submit-btn">
              Terminer <FontAwesomeIcon icon={faCheck} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
