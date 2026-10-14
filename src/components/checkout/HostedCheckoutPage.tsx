import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faMobileScreen,
  faCreditCard,
  faLock,
  faCheck,
  faSpinner,
  faArrowLeft,
  faCircleCheck,
  faCircleXmark,
  faClock,
  faReceipt,
  faArrowRight,
  faRotate,
  faCoins,
  faBuildingColumns,
} from '@fortawesome/free-solid-svg-icons';
import { apiClient } from '../../lib/api';
import { SUPPORTED_COUNTRIES, CountryCoverage, PaymentMethodOption } from '../../config/countries';

interface HostedCheckoutPageProps {
  onBack: () => void;
  initialAmount?: number;
  initialTitle?: string;
  paymentLinkSlug?: string;
}

export const HostedCheckoutPage: React.FC<HostedCheckoutPageProps> = ({
  onBack,
  initialAmount = 15000,
  initialTitle = 'Licence Pro PitchFlow',
  paymentLinkSlug,
}) => {
  // Mode: fixed vs libre
  const [isFixedAmount, setIsFixedAmount] = useState<boolean>(true);

  // Country & Methods
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('BJ');
  const currentCountry = SUPPORTED_COUNTRIES.find((c) => c.code === selectedCountryCode) || SUPPORTED_COUNTRIES[0];
  
  const [selectedMethodId, setSelectedMethodId] = useState<string>(currentCountry.methods[0]?.id || 'mtn_bj');
  const selectedMethod = currentCountry.methods.find((m) => m.id === selectedMethodId) || currentCountry.methods[0];

  // Customer info
  const [customerName, setCustomerName] = useState('Client Test');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('97 00 12 34');

  // Checkout details
  const [amount, setAmount] = useState<number>(initialAmount);
  const [title, setTitle] = useState<string>(initialTitle);
  const [merchantName, setMerchantName] = useState<string>('PitchFlow Studios');
  const [currency, setCurrency] = useState<string>(currentCountry.currency);

  // Fee configuration (Can be passed to client or absorbed by merchant)
  const [clientFeeEnabled, setClientFeeEnabled] = useState<boolean>(true);
  const [feeRate, setFeeRate] = useState<number>(2.2);

  // Calculation
  const feeAmount = clientFeeEnabled ? Math.round(amount * (feeRate / 100)) : 0;
  const totalAmount = amount + feeAmount;

  // Status & Transaction result
  const [status, setStatus] = useState<'idle' | 'loading' | 'pending' | 'success' | 'failed'>('idle');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paydunyaInvoiceUrl, setPaydunyaInvoiceUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  // Active payment link ID
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);

  // Update currency and default method when country changes
  useEffect(() => {
    setCurrency(currentCountry.currency);
    if (currentCountry.methods.length > 0) {
      setSelectedMethodId(currentCountry.methods[0].id);
      const parsedRate = parseFloat(currentCountry.methods[0].indicativeFee.replace(',', '.').replace('%', '').trim()) || 2.2;
      setFeeRate(parsedRate);
    }
  }, [selectedCountryCode]);

  // When method changes, update fee rate
  useEffect(() => {
    if (selectedMethod) {
      const parsedRate = parseFloat(selectedMethod.indicativeFee.replace(',', '.').replace('%', '').trim()) || 2.2;
      setFeeRate(parsedRate);
    }
  }, [selectedMethodId]);

  // Load real payment link if slug is provided via props or URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = paymentLinkSlug || urlParams.get('slug') || urlParams.get('link');

    if (slug) {
      apiClient.paymentLinks.getBySlug(slug).then((res) => {
        if (res.success && res.paymentLink) {
          const pl = res.paymentLink;
          if (pl.id) setPaymentLinkId(pl.id);
          if (pl.amount) {
            setAmount(Number(pl.amount));
            setIsFixedAmount(true);
          } else if (pl.isFixedAmount === false) {
            setIsFixedAmount(false);
          }
          if (pl.title) setTitle(String(pl.title));
          if (pl.merchantName) setMerchantName(String(pl.merchantName));
          if (pl.currency) setCurrency(String(pl.currency));
          if (pl.country) {
            const foundCountry = SUPPORTED_COUNTRIES.find((c) => c.code === pl.country);
            if (foundCountry) setSelectedCountryCode(foundCountry.code);
          }
        }
      }).catch((err) => {
        console.warn('Could not load payment link details:', err);
      });
    }
  }, [paymentLinkSlug]);

  // Polling for genuine payment completion
  useEffect(() => {
    if (status !== 'pending' || !transactionRef) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.checkout.getStatus(transactionRef);
        if (!isMounted) return;
        if (res.status === 'success') {
          setStatus('success');
          clearInterval(interval);
        } else if (res.status === 'failed') {
          setStatus('failed');
          setErrorMessage('La transaction a été rejetée ou annulée.');
          clearInterval(interval);
        }
      } catch (err) {
        // silent polling error
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [status, transactionRef]);

  const handleManualCheckStatus = async () => {
    if (!transactionRef) return;
    setIsCheckingStatus(true);
    setErrorMessage('');
    try {
      const res = await apiClient.checkout.getStatus(transactionRef);
      if (res.status === 'success') {
        setStatus('success');
      } else if (res.status === 'failed') {
        setStatus('failed');
        setErrorMessage('La transaction a été annulée ou rejetée par la passerelle.');
      } else {
        setErrorMessage('Paiement toujours en attente de confirmation sur le réseau opérateur.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de vérifier le statut.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setErrorMessage('Veuillez renseigner un montant valide.');
      return;
    }
    setStatus('loading');
    setErrorMessage('');

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const activeSlug = paymentLinkSlug || urlParams.get('slug') || urlParams.get('link') || undefined;

      const initRes = await apiClient.checkout.initiate({
        amount,
        currency,
        description: title,
        customerName: customerName.trim() || 'Client PitchFlow',
        customerEmail: customerEmail || `client_${phone.replace(/\s+/g, '')}@pichflow.com`,
        customerPhone: `${currentCountry.dialCode} ${phone}`,
        country: selectedCountryCode,
        paymentMethod: selectedMethod.name,
        clientFeeEnabled,
        feeRate,
        paymentLinkId: paymentLinkId || undefined,
        paymentLinkSlug: activeSlug,
      });

      setTransactionRef(initRes.reference);
      if (initRes.invoiceUrl || (initRes as any).checkoutUrl) {
        setPaydunyaInvoiceUrl(initRes.invoiceUrl || (initRes as any).checkoutUrl);
      }
      setStatus('pending');
    } catch (err: any) {
      console.error('[Hosted Checkout] Error:', err);
      setStatus('failed');
      setErrorMessage(err.message || 'Échec de l’initiation du paiement sur la passerelle SasPay.');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setErrorMessage('');
    setPaydunyaInvoiceUrl('');
  };

  // Helper to get CSS logo class matching checkout.css
  const getMethodBrandClass = (method: PaymentMethodOption) => {
    const id = method.id.toLowerCase();
    const name = method.name.toLowerCase();
    if (id.includes('celtiis') || name.includes('celtiis')) return 'celtiis';
    if (id.includes('mtn') || name.includes('mtn')) return 'mtn';
    if (id.includes('moov') || name.includes('moov')) return 'moov';
    if (id.includes('wave') || name.includes('wave')) return 'wave';
    if (id.includes('orange') || name.includes('orange')) return 'orange';
    if (id.includes('crypto') || method.type === 'crypto') return 'crypto';
    if (id.includes('card') || method.type === 'card') return 'card';
    if (id.includes('expresso')) return 'expresso';
    if (id.includes('free')) return 'free';
    return 'card';
  };

  // Helper for logo content
  const renderMethodLogo = (method: PaymentMethodOption) => {
    const brand = getMethodBrandClass(method);
    switch (brand) {
      case 'celtiis':
        return <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>C</span>;
      case 'mtn':
        return <span style={{ fontWeight: 900, fontSize: '0.75rem', letterSpacing: '-0.02em' }}>MTN</span>;
      case 'moov':
        return <span style={{ fontWeight: 800, fontSize: '0.72rem' }}>Moov</span>;
      case 'wave':
        return <span style={{ fontWeight: 900, fontSize: '0.75rem' }}>Wave</span>;
      case 'orange':
        return <span style={{ fontWeight: 900, fontSize: '0.75rem' }}>OM</span>;
      case 'crypto':
        return <FontAwesomeIcon icon={faCoins} style={{ fontSize: '0.85rem' }} />;
      default:
        return <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '0.85rem' }} />;
    }
  };

  return (
    <div className="pf-saspay-checkout-page">
      <div className="pf-saspay-checkout-card">
        {/* Back link in top-left */}
        <button
          onClick={onBack}
          className="pf-saspay-back-link"
          type="button"
          title="Retourner à la page précédente"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Retour</span>
        </button>

        {/* 1. IDLE / FORM STATE (Screenshot design matching 214008, 214119 & 213855) */}
        {status === 'idle' && (
          <form onSubmit={handlePay}>
            {/* Header: Fixed Amount vs Custom Libre */}
            {isFixedAmount ? (
              <div className="pf-saspay-header-fixed">
                <div className="pf-saspay-header-left">
                  <div className="pf-saspay-avatar-badge">
                    {merchantName.charAt(0).toUpperCase()}
                  </div>
                  <div className="pf-saspay-header-titles">
                    <div className="pf-saspay-header-title">{title}</div>
                    <div className="pf-saspay-header-sub">{merchantName}</div>
                  </div>
                </div>
                <div className="pf-saspay-header-price">
                  {new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}
                </div>
              </div>
            ) : (
              <div className="pf-saspay-header-libre">
                <div className="pf-saspay-avatar-badge center">
                  {merchantName.charAt(0).toUpperCase()}
                </div>
                <div className="pf-saspay-sub-libre">Faire un paiement à</div>
                <div className="pf-saspay-title-libre">{merchantName}</div>
              </div>
            )}

            {/* If Libre amount, customer enters custom amount */}
            {!isFixedAmount && (
              <div className="pf-saspay-form-group">
                <label className="pf-saspay-label">
                  Montant à payer ({currency}) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  className="pf-saspay-input"
                  min="100"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(100, Number(e.target.value)))}
                  placeholder="Ex: 5000"
                  required
                />
              </div>
            )}

            {/* Country Selector Dropdown with Flags */}
            <div className="pf-saspay-form-group">
              <label className="pf-saspay-label">Pays</label>
              <div className="pf-saspay-select-wrap">
                <select
                  className="pf-saspay-select"
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.dialCode}) — {c.currency}
                    </option>
                  ))}
                </select>
                <div className="pf-saspay-select-chevron">▾</div>
              </div>
            </div>

            {/* Payment Methods 2-Column Grid (Exact Screenshot Style) */}
            <div className="pf-saspay-methods-grid">
              {currentCountry.methods.map((method) => {
                const isSelected = selectedMethodId === method.id;
                const brandClass = getMethodBrandClass(method);
                return (
                  <div
                    key={method.id}
                    onClick={() => setSelectedMethodId(method.id)}
                    className={`pf-saspay-method-card ${isSelected ? 'active' : ''}`}
                  >
                    <div className={`pf-saspay-method-logo ${brandClass}`}>
                      {renderMethodLogo(method)}
                    </div>
                    <div className="pf-saspay-method-info">
                      <div className="pf-saspay-method-name">{method.name}</div>
                      <div className="pf-saspay-method-fee">{method.indicativeFee}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Customer Name & Email row */}
            <div className="pf-saspay-form-row">
              <div>
                <label className="pf-saspay-label">Nom complet</label>
                <input
                  type="text"
                  className="pf-saspay-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Paul Dossou"
                  required
                />
              </div>
              <div>
                <label className="pf-saspay-label">Email pour reçu</label>
                <input
                  type="email"
                  className="pf-saspay-input"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="paul@email.com"
                />
              </div>
            </div>

            {/* Phone Input with calling code divider for Mobile Money OR Card fields */}
            {selectedMethod.type === 'mobile_money' ? (
              <div className="pf-saspay-form-group">
                <label className="pf-saspay-label">
                  Numéro {selectedMethod.name}
                </label>
                <div className="pf-saspay-phone-row">
                  <span className="pf-saspay-phone-icon">
                    <FontAwesomeIcon icon={faMobileScreen} />
                  </span>
                  <span className="pf-saspay-phone-code">{currentCountry.dialCode}</span>
                  <div className="pf-saspay-phone-divider" />
                  <input
                    type="tel"
                    className="pf-saspay-phone-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="97 00 12 34"
                    required
                  />
                </div>
              </div>
            ) : selectedMethod.type === 'card' ? (
              <div className="pf-saspay-form-group">
                <label className="pf-saspay-label">Numéro de carte bancaire</label>
                <input
                  type="text"
                  className="pf-saspay-input"
                  defaultValue="4242 •••• •••• 4242"
                  disabled
                  style={{ background: '#F9FAFB' }}
                />
              </div>
            ) : (
              <div className="pf-saspay-form-group">
                <label className="pf-saspay-label">Adresse de wallet / Référence</label>
                <input
                  type="text"
                  className="pf-saspay-input"
                  placeholder="USDT TRC20 / BEP20"
                  defaultValue="TKr98q...SandboxWallet"
                  disabled
                  style={{ background: '#F9FAFB' }}
                />
              </div>
            )}

            {/* USSD Notice Chip */}
            <div className="pf-saspay-notice-chip">
              📲 Une invite de validation USSD apparaîtra instantanément sur votre téléphone portable.
            </div>

            {/* Summary Breakdown Box (Montant, Frais, Total à payer) */}
            <div className="pf-saspay-summary-box">
              <div className="pf-saspay-summary-row">
                <span>Montant de la commande</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>
                  {new Intl.NumberFormat('fr-FR').format(amount)} {currency}
                </span>
              </div>
              {clientFeeEnabled && feeAmount > 0 && (
                <div className="pf-saspay-summary-row">
                  <span>Frais de passerelle ({feeRate} %)</span>
                  <span style={{ fontWeight: 600, color: '#5E30E8' }}>
                    + {new Intl.NumberFormat('fr-FR').format(feeAmount)} {currency}
                  </span>
                </div>
              )}
              <div className="pf-saspay-summary-divider" />
              <div className="pf-saspay-summary-total">
                <span>Total à payer</span>
                <span>
                  {new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}
                </span>
              </div>
            </div>

            {/* Submit Button (Purple #5E30E8) */}
            <button
              type="submit"
              className="pf-saspay-submit-btn"
            >
              <span>Payer {new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}</span>
            </button>
          </form>
        )}

        {/* 2. LOADING STATE */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div className="pf-saspay-pending-icon-wrap">
              <div className="pf-saspay-spinner-arc" />
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
            <div className="pf-saspay-pending-title">
              Connexion à {selectedMethod.name}...
            </div>
            <div className="pf-saspay-pending-sub">
              Préparation sécurisée du débit sur le réseau opérateur {currentCountry.name}.
            </div>
          </div>
        )}

        {/* 3. PENDING STATE (Screenshot 214135: Confirme le paiement sur ton téléphone) */}
        {status === 'pending' && (
          <div className="pf-saspay-pending-view">
            <div className="pf-saspay-pending-icon-wrap">
              <div className="pf-saspay-spinner-arc" />
              <FontAwesomeIcon icon={faMobileScreen} />
            </div>
            <div className="pf-saspay-pending-title">
              Confirme le paiement sur ton téléphone
            </div>
            <div className="pf-saspay-pending-sub">
              Une demande de débit de <strong>{new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}</strong> a été transmise à ton numéro <strong>{currentCountry.dialCode} {phone}</strong>.
            </div>

            <div className="pf-saspay-step-box">
              <div className="pf-saspay-step-num">1</div>
              <div className="pf-saspay-step-text">
                Consulte ton écran de téléphone et tape ton code secret <strong>{selectedMethod.name}</strong> pour approuver le débit.
              </div>
            </div>

            {/* Direct Gateway Payment Action if checkout URL provided (Wave, Orange Money, Card, etc.) */}
            {paydunyaInvoiceUrl && (
              <div className="pf-saspay-sandbox-action-box">
                <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.65rem' }}>
                  Page de validation sécurisée de la passerelle :
                </p>
                <a
                  href={paydunyaInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-saspay-sandbox-action-btn"
                >
                  <span>Finaliser le paiement sécurisé</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </a>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8125rem', color: '#5E30E8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>En attente de confirmation de la transaction...</span>
              </div>

              <button
                type="button"
                onClick={handleManualCheckStatus}
                disabled={isCheckingStatus}
                className="pf-saspay-retry-btn"
                style={{
                  background: '#F1F5F9',
                  color: '#475569',
                  fontSize: '0.8125rem',
                  padding: '0.55rem 1.25rem',
                  boxShadow: 'none',
                }}
              >
                <FontAwesomeIcon icon={faRotate} spin={isCheckingStatus} style={{ marginRight: '0.4rem' }} />
                <span>{isCheckingStatus ? 'Vérification...' : 'Actualiser le statut'}</span>
              </button>

              {errorMessage && (
                <p style={{ color: '#D97706', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4. FAILED STATE (Screenshot 213954: Paiement échoué) */}
        {status === 'failed' && (
          <div className="pf-saspay-failed-view">
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: '#FEE2E2',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                fontSize: '1.85rem',
              }}
            >
              <FontAwesomeIcon icon={faCircleXmark} />
            </div>
            <div className="pf-saspay-failed-title">Paiement échoué</div>
            <div className="pf-saspay-failed-sub">
              {errorMessage || 'La transaction n’a pas pu être validée par la passerelle de paiement.'}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="pf-saspay-retry-btn"
            >
              Réessayer le paiement
            </button>
          </div>
        )}

        {/* 5. SUCCESS STATE */}
        {status === 'success' && (
          <div className="pf-saspay-success-view">
            <div className="pf-saspay-success-icon-wrap">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <div className="pf-saspay-success-title">Paiement réussi !</div>
            <div className="pf-saspay-success-sub">
              Votre transaction de <strong>{new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}</strong> a été validée avec succès auprès de <strong>{selectedMethod.name}</strong>.
            </div>

            <div className="pf-saspay-receipt-box">
              <div className="pf-saspay-receipt-row">
                <span className="pf-saspay-receipt-lbl">Réf. Transaction :</span>
                <span className="pf-saspay-receipt-val">{transactionRef || 'TX-PF-SUCCESS'}</span>
              </div>
              <div className="pf-saspay-receipt-row">
                <span className="pf-saspay-receipt-lbl">Montant réglé :</span>
                <span className="pf-saspay-receipt-val">{new Intl.NumberFormat('fr-FR').format(totalAmount)} {currency}</span>
              </div>
              <div className="pf-saspay-receipt-row">
                <span className="pf-saspay-receipt-lbl">Moyen de paiement :</span>
                <span className="pf-saspay-receipt-val">{selectedMethod.name}</span>
              </div>
              <div className="pf-saspay-receipt-row">
                <span className="pf-saspay-receipt-lbl">Date & heure :</span>
                <span className="pf-saspay-receipt-val">{new Date().toLocaleString('fr-FR')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="pf-saspay-retry-btn"
            >
              Effectuer un autre paiement
            </button>
          </div>
        )}

        {/* Watermark Footer (Exact Screenshot: 🔒 Paiement sécurisé propulsé par PichFlow) */}
        <div className="pf-saspay-watermark">
          <span className="pf-saspay-watermark-lock">
            <FontAwesomeIcon icon={faLock} />
          </span>
          <span>Paiement sécurisé propulsé par</span>
          <span className="pf-saspay-watermark-brand">
            <span className="pf-saspay-watermark-icon">⚡</span>
            PichFlow
          </span>
        </div>
      </div>
    </div>
  );
};
