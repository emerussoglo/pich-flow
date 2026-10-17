import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PaymentLink, Transaction, Application } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTrash,
  faArrowLeft,
  faCopy,
  faCheck,
  faEye,
  faRotate,
  faLink,
  faPowerOff,
  faPen,
  faExternalLinkAlt,
  faXmark,
  faDesktop,
  faMobileScreen,
  faLock,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { SUPPORTED_COUNTRIES } from '../../config/countries';

interface PaymentLinksViewProps {
  appName?: string;
  activeApp?: Application;
  paymentLinks?: PaymentLink[];
  initialMode?: 'list' | 'create';
  onOpenCreateModal?: () => void;
  onPreviewLink?: (link: PaymentLink) => void;
}

export const PaymentLinksView: React.FC<PaymentLinksViewProps> = ({
  appName = 'Mon Application',
  activeApp,
  initialMode = 'list',
  onPreviewLink,
}) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'create'>(initialMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const linksRequestId = useRef(0);
  const linkTransactionsRequestId = useRef(0);

  // Details Modal
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [linkTransactions, setLinkTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Edit Modal
  const [editLink, setEditLink] = useState<PaymentLink | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number | undefined>(undefined);

  // Form states for creation
  const [name, setName] = useState('Licence Pro PichFlow');
  const [desc, setDesc] = useState('Accès complet aux modules et intégrations');
  const [amountType, setAmountType] = useState<'fixed' | 'libre'>('fixed');
  const [amountVal, setAmountVal] = useState('15000');
  const [currency, setCurrency] = useState('XOF');
  const [maxUsage, setMaxUsage] = useState('');
  const [defaultCountry, setDefaultCountry] = useState('BJ');
  const [customSlug, setCustomSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Studio Preview States
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const currentPreviewCountry = SUPPORTED_COUNTRIES.find((c) => c.code === defaultCountry) || SUPPORTED_COUNTRIES[0];
  const [previewPhone, setPreviewPhone] = useState('97 00 12 34');

  const numericAmount = amountType === 'fixed' ? Number(amountVal) || 0 : 5000;
  const previewTotal = numericAmount;

  const loadLinks = useCallback(async () => {
    const requestId = ++linksRequestId.current;
    linkTransactionsRequestId.current += 1;
    setIsLoading(true);
    setLinks([]);
    setSelectedLink(null);
    setLinkTransactions([]);
    setEditLink(null);
    if (!activeApp?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const backendLinks = await apiClient.paymentLinks.getAll(activeApp.id);
      if (requestId !== linksRequestId.current) return;
      setLinks(backendLinks || []);
    } catch {
      if (requestId !== linksRequestId.current) return;
      showToast('Impossible de charger les liens de paiement.', 'error');
    } finally {
      if (requestId === linksRequestId.current) setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const copyPublicUrl = (slug: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fullUrl = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    showToast('URL publique copiée dans le presse-papier !', 'info');
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleOpenDetails = async (link: PaymentLink) => {
    if (!activeApp?.id) {
      setSelectedLink(null);
      setLinkTransactions([]);
      setLoadingTx(false);
      return;
    }
    const requestId = ++linkTransactionsRequestId.current;
    setSelectedLink(link);
    setLoadingTx(true);
    try {
      const allTx = await apiClient.transactions.getAll(activeApp.id);
      if (requestId !== linkTransactionsRequestId.current) return;
      const matched = allTx.filter((t) => t.paymentLinkId === link.id);
      setLinkTransactions(matched);
    } catch {
      if (requestId !== linkTransactionsRequestId.current) return;
      setLinkTransactions([]);
    } finally {
      if (requestId === linkTransactionsRequestId.current) setLoadingTx(false);
    }
  };

  const handleToggleStatus = async (link: PaymentLink, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = link.status === 'active' ? 'archived' : 'active';
    try {
      await apiClient.paymentLinks.update(link.id, { status: newStatus });
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, status: newStatus } : l))
      );
      if (selectedLink?.id === link.id) {
        setSelectedLink((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      showToast(
        newStatus === 'active' ? 'Lien de paiement réactivé.' : 'Lien de paiement désactivé.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Impossible de modifier le statut.', 'error');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement ce lien de paiement ? Les écritures financières existantes resteront tracées.')) {
      return;
    }
    try {
      await apiClient.paymentLinks.delete(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      if (selectedLink?.id === id) setSelectedLink(null);
      showToast('Lien de paiement supprimé avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer ce lien.', 'error');
    }
  };

  const handleOpenEdit = (link: PaymentLink, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLink(link);
    setEditTitle(link.title);
    setEditDesc(link.description || '');
    setEditAmount(link.amount === null ? undefined : link.amount);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLink) return;
    try {
      await apiClient.paymentLinks.update(editLink.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        amount: editAmount,
      });

      setLinks((prev) =>
        prev.map((l) =>
          l.id === editLink.id
            ? {
                ...l,
                title: editTitle.trim(),
                description: editDesc.trim(),
                amount: editAmount === undefined ? null : editAmount,
              }
            : l
        )
      );
      setEditLink(null);
      showToast('Paramètres du lien modifiés avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la modification.', 'error');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await apiClient.paymentLinks.create({
        title: name.trim(),
        description: desc.trim() || 'Paiement en ligne sécurisé',
        amount: amountType === 'fixed' ? Number(amountVal) : undefined,
        isFixedAmount: amountType === 'fixed',
        currency,
        country: defaultCountry,
        usageLimit: maxUsage ? Number(maxUsage) : undefined,
        requirePhone: true,
        applicationId: activeApp?.id,
      });

      setLinks((prev) => [created, ...prev]);
      setViewMode('list');
      setName('Licence Pro PichFlow');
      setDesc('Accès complet aux modules et intégrations');
      showToast(`Lien "${created.title}" créé avec succès !`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Impossible de créer le lien de paiement.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLinks = links.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      (l.description && l.description.toLowerCase().includes(term)) ||
      l.slug.toLowerCase().includes(term)
    );
  });

  // If in create view -> SPLIT STUDIO WITH LIVE CHECKOUT PREVIEW
  if (viewMode === 'create') {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {/* Top return bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Retour à la liste des liens</span>
          </button>
          <h1 className="pf-page-title" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
            Créer un lien de paiement
          </h1>
          <p className="pf-page-subtitle">
            Configurez votre offre et visualisez en direct la page de paiement sécurisée que vos clients verront.
          </p>
        </div>

        {/* 2-Column Split Studio */}
        <div className="pf-payment-link-studio">
          {/* LEFT COLUMN: Configuration Form */}
          <div className="pf-ui-card" style={{ padding: '1.75rem' }}>
            <form onSubmit={handleCreateSubmit}>
              {/* Section 1: Produit & Tarification */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                    1. Produit & Tarification
                  </span>
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">
                    Nom du produit ou service <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="pf-input"
                    placeholder="Ex: Licence Pro PichFlow, Formation Growth..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">Description (affichée au client)</label>
                  <input
                    type="text"
                    className="pf-input"
                    placeholder="Ex: Accès complet aux modules et intégrations"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>

                {/* Amount type pills */}
                <div className="pf-form-group">
                  <label className="pf-label">Type de tarification</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setAmountType('fixed')}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        border: amountType === 'fixed' ? '2px solid #5E30E8' : '1px solid #E2E8F0',
                        background: amountType === 'fixed' ? '#FAF9FF' : '#FFFFFF',
                        color: amountType === 'fixed' ? '#5E30E8' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      Montant fixe
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountType('libre')}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        border: amountType === 'libre' ? '2px solid #5E30E8' : '1px solid #E2E8F0',
                        background: amountType === 'libre' ? '#FAF9FF' : '#FFFFFF',
                        color: amountType === 'libre' ? '#5E30E8' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      Don / Montant libre
                    </button>
                  </div>
                </div>

                {/* Amount & Currency */}
                <div style={{ display: 'grid', gridTemplateColumns: amountType === 'fixed' ? '2fr 1fr' : '1fr', gap: '0.75rem' }}>
                  {amountType === 'fixed' && (
                    <div className="pf-form-group">
                      <label className="pf-label">
                        Montant <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="pf-input"
                        value={amountVal}
                        onChange={(e) => setAmountVal(e.target.value)}
                        min="100"
                        required
                      />
                    </div>
                  )}

                  <div className="pf-form-group">
                    <label className="pf-label">Devise</label>
                    <select
                      className="pf-select"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="XOF">XOF (FCFA UEMOA)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Payment context */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                    2. Pays et expérience client
                  </span>
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">Pays configuré</label>
                  <select
                    className="pf-select"
                    value={defaultCountry}
                    onChange={(e) => setDefaultCountry(e.target.value)}
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.dialCode}) — {c.currency}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pf-form-group" style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                    Numéro de téléphone obligatoire
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    Le client sera redirigé vers le checkout sécurisé PayDunya. Les moyens disponibles dépendent de la configuration du compte.
                  </div>
                </div>
              </div>

              {/* Section 3: URL & Limites */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                    3. Options avancées
                  </span>
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">Limite d'utilisations (Optionnel)</label>
                  <input
                    type="number"
                    className="pf-input"
                    placeholder="Illimité si vide (ex: 50)"
                    value={maxUsage}
                    onChange={(e) => setMaxUsage(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1.5, background: '#5E30E8', border: 'none' }}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>{isSubmitting ? 'Création...' : 'Créer et activer le lien'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: Real-Time Interactive Live Preview */}
          <div className="pf-preview-sticky-wrap">
            {/* Header bar with Live badge & Device toggle */}
            <div className="pf-preview-header-bar">
              <div className="pf-preview-live-badge">
                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', animation: 'pulse 1.8s infinite' }} />
                <span>Aperçu en direct</span>
              </div>

              <div className="pf-device-toggle-bar">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`pf-device-toggle-btn ${previewDevice === 'desktop' ? 'active' : ''}`}
                  title="Vue Ordinateur"
                >
                  <FontAwesomeIcon icon={faDesktop} />
                  <span>Ordinateur</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`pf-device-toggle-btn ${previewDevice === 'mobile' ? 'active' : ''}`}
                  title="Vue Mobile"
                >
                  <FontAwesomeIcon icon={faMobileScreen} />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Frame containing the EXACT Checkout Card from user screenshots */}
            <div className={previewDevice === 'mobile' ? 'pf-mobile-frame' : 'pf-desktop-preview-frame'}>
              {previewDevice === 'mobile' && <div className="pf-mobile-speaker" />}

              <div className="pf-ui-checkout-card" style={{ boxShadow: previewDevice === 'mobile' ? 'none' : undefined, borderRadius: previewDevice === 'mobile' ? '28px' : undefined }}>
                {/* Fixed vs Libre Header */}
                {amountType === 'fixed' ? (
                  <div className="pf-ui-header-fixed">
                    <div className="pf-ui-header-left">
                      <div className="pf-ui-avatar-badge">
                        {(activeApp?.name || appName || 'P').charAt(0).toUpperCase()}
                      </div>
                      <div className="pf-ui-header-titles">
                        <div className="pf-ui-header-title">
                          {name.trim() || 'Titre du produit'}
                        </div>
                        <div className="pf-ui-header-sub">
                          {activeApp?.name || appName || 'PichFlow Store'}
                        </div>
                      </div>
                    </div>
                    <div className="pf-ui-header-price">
                      {new Intl.NumberFormat('fr-FR').format(previewTotal)} {currency}
                    </div>
                  </div>
                ) : (
                  <div className="pf-ui-header-libre">
                    <div className="pf-ui-avatar-badge center">
                      {(activeApp?.name || appName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="pf-ui-sub-libre">Faire un paiement à</div>
                    <div className="pf-ui-title-libre">
                      {activeApp?.name || appName || 'PichFlow Store'}
                    </div>
                  </div>
                )}

                {/* If Libre amount, custom input */}
                {amountType === 'libre' && (
                  <div className="pf-ui-form-group">
                    <label className="pf-ui-label">Montant à régler ({currency})</label>
                    <input
                      type="number"
                      className="pf-ui-input"
                      value={amountVal}
                      onChange={(e) => setAmountVal(e.target.value)}
                      placeholder="Ex: 5000"
                    />
                  </div>
                )}

                {/* Country dropdown */}
                <div className="pf-ui-form-group">
                  <label className="pf-ui-label">Pays</label>
                  <div className="pf-ui-select-wrap">
                    <select
                      className="pf-ui-select"
                      value={defaultCountry}
                      onChange={(e) => setDefaultCountry(e.target.value)}
                    >
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.dialCode})
                        </option>
                      ))}
                    </select>
                    <div className="pf-ui-select-chevron">▾</div>
                  </div>
                </div>

                <div className="pf-ui-notice-chip">
                  Les moyens de paiement réellement disponibles seront présentés dans le checkout sécurisé PayDunya.
                </div>

                {/* Customer Info */}
                <div className="pf-ui-form-row">
                  <div>
                    <label className="pf-ui-label">Nom complet</label>
                    <input
                      type="text"
                      className="pf-ui-input"
                      defaultValue="Paul Dossou"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="pf-ui-label">Email pour reçu</label>
                    <input
                      type="email"
                      className="pf-ui-input"
                      defaultValue="paul@email.com"
                      readOnly
                    />
                  </div>
                </div>

                {/* Phone Input with Calling Code Divider */}
                <div className="pf-ui-form-group">
                  <label className="pf-ui-label">Numéro de téléphone</label>
                  <div className="pf-ui-phone-row">
                    <span className="pf-ui-phone-icon">
                      <FontAwesomeIcon icon={faMobileScreen} />
                    </span>
                    <span className="pf-ui-phone-code">{currentPreviewCountry.dialCode}</span>
                    <div className="pf-ui-phone-divider" />
                    <input
                      type="tel"
                      className="pf-ui-phone-input"
                      value={previewPhone}
                      onChange={(e) => setPreviewPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Notice Chip */}
                <div className="pf-ui-notice-chip">
                  Le paiement se poursuit sur la page sécurisée PayDunya.
                </div>

                {/* Summary Breakdown Box */}
                <div className="pf-ui-summary-box">
                  <div className="pf-ui-summary-row">
                    <span>Montant de la commande</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      {new Intl.NumberFormat('fr-FR').format(numericAmount)} {currency}
                    </span>
                  </div>
                  <div className="pf-ui-summary-divider" />
                  <div className="pf-ui-summary-total">
                    <span>Total à payer</span>
                    <span>
                      {new Intl.NumberFormat('fr-FR').format(previewTotal)} {currency}
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  className="pf-ui-submit-btn"
                  style={{ pointerEvents: 'none' }}
                >
                  <span>Payer {new Intl.NumberFormat('fr-FR').format(previewTotal)} {currency}</span>
                </button>

                {/* PichFlow Watermark Footer */}
                <div className="pf-ui-watermark">
                  <span className="pf-ui-watermark-lock">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <span>Paiement sécurisé propulsé par</span>
                  <span className="pf-ui-watermark-brand">
                    <span className="pf-ui-watermark-icon">⚡</span>
                    PichFlow
                  </span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748B', textAlign: 'center', marginTop: '0.75rem', maxWidth: '380px' }}>
              Aperçu synchronisé en temps réel : Vos clients accèdent à ce checkout optimisé pour mobile et web.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div>
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Liens de paiement</h1>
          <p className="pf-page-subtitle">
            Partagez un lien sécurisé pour encaisser vos clients sur {appName} sans intégration technique.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadLinks}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les liens"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => setViewMode('create')}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Créer un lien</span>
          </button>
        </div>
      </div>

      <div className="pf-ui-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="pf-search-filter-input"
          style={{ width: '100%', boxSizing: 'border-box' }}
          placeholder="Rechercher par nom, description ou identifiant de lien..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredLinks.length === 0 ? (
        <div className="pf-ui-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '1.5rem',
            }}
          >
            <FontAwesomeIcon icon={faLink} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Aucun lien de paiement pour le moment
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Créez un lien à montant fixe ou libre à partager par WhatsApp, e-mail, SMS ou réseaux sociaux pour recevoir vos paiements PayDunya Sandbox.
          </p>
          <button
            onClick={() => setViewMode('create')}
            className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Créer votre premier lien</span>
          </button>
        </div>
      ) : (
        <div className="pf-ui-table-wrapper" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="pf-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="pf-ui-table" style={{ width: '100%', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th>NOM & DESCRIPTION</th>
                  <th>MONTANT</th>
                  <th>URL PUBLIQUE</th>
                  <th>STATUT</th>
                  <th>UTILISATIONS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.875rem' }}>
                          {link.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.1rem' }}>
                          {link.description || 'Paiement sécurisé'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>
                        {link.isFixedAmount && link.amount
                          ? `${Number(link.amount).toLocaleString('fr-FR')} ${link.currency || 'XOF'}`
                          : `Libre (${link.currency || 'XOF'})`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontFamily: 'monospace', color: '#2563EB', fontSize: '0.8125rem' }}>
                          /pay/{link.slug}
                        </span>
                        <button
                          onClick={(e) => copyPublicUrl(link.slug, e)}
                          title="Copier l'URL complète"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedSlug === link.slug ? '#16A34A' : '#94A3B8',
                            cursor: 'pointer',
                            padding: '0.2rem',
                          }}
                        >
                          <FontAwesomeIcon icon={copiedSlug === link.slug ? faCheck : faCopy} />
                        </button>
                        <a
                          href={`/pay/${link.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Tester le lien dans un nouvel onglet"
                          style={{ color: '#64748B', padding: '0.2rem' }}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} style={{ fontSize: '0.75rem' }} />
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`pf-pill-status ${link.status === 'active' ? 'actif' : 'inactif'}`}>
                        {link.status === 'active' ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.875rem' }}>
                        {link.usageCount || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenDetails(link)}
                          title="Voir la page de détails"
                          style={{
                            background: '#F1F5F9',
                            border: 'none',
                            color: '#475569',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                        <button
                          onClick={(e) => handleOpenEdit(link, e)}
                          title="Modifier les paramètres"
                          style={{
                            background: '#F1F5F9',
                            border: 'none',
                            color: '#2563EB',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button
                          onClick={(e) => handleToggleStatus(link, e)}
                          title={link.status === 'active' ? 'Désactiver le lien' : 'Réactiver le lien'}
                          style={{
                            background: '#F1F5F9',
                            border: 'none',
                            color: link.status === 'active' ? '#D97706' : '#16A34A',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <FontAwesomeIcon icon={faPowerOff} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(link.id, e)}
                          title="Supprimer définitivement"
                          style={{
                            background: '#F1F5F9',
                            border: 'none',
                            color: '#EF4444',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: PAGE COMPLETE DE DETAILS DU LIEN */}
      {selectedLink && (
        <div className="pf-modal-overlay" onClick={() => setSelectedLink(null)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Détails du lien : {selectedLink.title}</h3>
              <button onClick={() => setSelectedLink(null)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.25rem', lineHeight: '1.8', fontSize: '0.875rem' }}>
              <div><strong>Nom du lien :</strong> {selectedLink.title}</div>
              <div><strong>Description :</strong> {selectedLink.description || 'Non renseignée'}</div>
              <div>
                <strong>URL publique client :</strong>{' '}
                <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>
                  {window.location.origin}/pay/{selectedLink.slug}
                </span>{' '}
                <button
                  onClick={() => copyPublicUrl(selectedLink.slug)}
                  style={{ border: 'none', background: 'transparent', color: '#2563EB', cursor: 'pointer', padding: '0 4px' }}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
              </div>
              <div>
                <strong>Type de montant :</strong>{' '}
                {selectedLink.isFixedAmount ? `Fixe (${selectedLink.amount} ${selectedLink.currency})` : `Libre (${selectedLink.currency})`}
              </div>
              <div><strong>Statut :</strong> <span className={`pf-pill-status ${selectedLink.status === 'active' ? 'actif' : 'inactif'}`}>{selectedLink.status === 'active' ? 'Actif' : 'Désactivé'}</span></div>
              <div><strong>Nombre d'utilisations :</strong> {selectedLink.usageCount || 0}</div>
              <div>
                <strong>Date de création :</strong>{' '}
                {new Date(selectedLink.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {/* Transactions liées */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#0F172A' }}>
                Transactions associées à ce lien ({linkTransactions.length})
              </div>
              {loadingTx ? (
                <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>Chargement des transactions...</div>
              ) : linkTransactions.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: '#64748B', background: '#F1F5F9', padding: '0.75rem', borderRadius: '8px' }}>
                  Aucune transaction enregistrée pour ce lien.
                </div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {linkTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        marginBottom: '0.35rem',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace' }}>{tx.reference || tx.id}</span>
                      <strong>{tx.amount} {tx.currency}</strong>
                      <span className={`pf-pill-status ${tx.status === 'completed' ? 'reussi' : 'echoue'}`}>{tx.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setSelectedLink(null)}
                className="pf-btn pf-btn-secondary pf-btn-md"
                style={{ flex: 1 }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MODIFIER LE LIEN */}
      {editLink && (
        <div className="pf-modal-overlay" onClick={() => setEditLink(null)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Modifier le lien de paiement</h3>
              <button onClick={() => setEditLink(null)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="pf-form-group">
                <label className="pf-label">Nom du lien</label>
                <input
                  type="text"
                  className="pf-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Description</label>
                <input
                  type="text"
                  className="pf-input"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {editLink.isFixedAmount && (
                <div className="pf-form-group">
                  <label className="pf-label">Montant ({editLink.currency})</label>
                  <input
                    type="number"
                    className="pf-input"
                    value={editAmount || ''}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    min="100"
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditLink(null)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>Sauvegarder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
