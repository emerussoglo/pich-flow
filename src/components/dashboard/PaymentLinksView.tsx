import React, { useState, useEffect, useCallback } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { PAYDUNYA_MINIMUM_AMOUNT_XOF } from '../../config/payments';
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

  // Details Modal
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [linkTransactions, setLinkTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Edit Modal
  const [editLink, setEditLink] = useState<PaymentLink | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number | undefined>(undefined);
  const [editRequirePhone, setEditRequirePhone] = useState(false);

  // Form states for creation
  const [name, setName] = useState('Licence Pro PitchFlow');
  const [desc, setDesc] = useState('Accès complet aux modules et intégrations');
  const [amountType, setAmountType] = useState<'fixed' | 'libre'>('fixed');
  const [amountVal, setAmountVal] = useState('15000');
  const [currency, setCurrency] = useState('XOF');
  const [maxUsage, setMaxUsage] = useState('');
  const [defaultCountry, setDefaultCountry] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [requirePhone, setRequirePhone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentlyCreatedLink, setRecentlyCreatedLink] = useState<PaymentLink | null>(null);

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const backendLinks = await apiClient.paymentLinks.getAll(activeApp?.id);
      setLinks(backendLinks || []);
    } catch {
      showToast('Impossible de charger les liens de paiement.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const copyPublicUrl = (slug: string, e?: React.MouseEvent, paymentUrl?: string) => {
    if (e) e.stopPropagation();
    const fullUrl = paymentUrl || links.find((link) => link.slug === slug)?.paymentUrl || `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    showToast('URL publique copiée dans le presse-papier !', 'info');
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleOpenDetails = async (link: PaymentLink) => {
    setSelectedLink(link);
    setLoadingTx(true);
    try {
      const allTx = await apiClient.transactions.getAll();
      const matched = allTx.filter((t) => t.paymentLinkId === link.id);
      setLinkTransactions(matched);
    } catch {
      setLinkTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleToggleStatus = async (link: PaymentLink, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = link.status === 'active' ? 'archived' : 'active';
    try {
      await apiClient.paymentLinks.update(link.id, { status: newStatus, applicationId: activeApp?.id || '' });
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
      await apiClient.paymentLinks.delete(id, activeApp?.id || '');
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
    setEditRequirePhone(Boolean(link.requirePhone));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLink) return;
    try {
      await apiClient.paymentLinks.update(editLink.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        amount: editAmount,
        requirePhone: editRequirePhone,
        applicationId: activeApp?.id || '',
      });

      setLinks((prev) =>
        prev.map((l) =>
          l.id === editLink.id
            ? {
                ...l,
                title: editTitle.trim(),
                description: editDesc.trim(),
                amount: editAmount === undefined ? null : editAmount,
                requirePhone: editRequirePhone,
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
    if (amountType === 'fixed' && (!Number.isSafeInteger(Number(amountVal)) || Number(amountVal) < PAYDUNYA_MINIMUM_AMOUNT_XOF)) {
      showToast(`Le montant minimum accepté par PayDunya est de ${PAYDUNYA_MINIMUM_AMOUNT_XOF} XOF.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiClient.paymentLinks.create({
        title: name.trim(),
        description: desc.trim() || 'Paiement en ligne sécurisé',
        amount: amountType === 'fixed' ? Number(amountVal) : undefined,
        isFixedAmount: amountType === 'fixed',
        currency: amountType === 'fixed' ? currency : 'XOF',
        country: defaultCountry,
        expiresAt: expiresAt || undefined,
        usageLimit: maxUsage ? Number(maxUsage) : undefined,
        requirePhone,
        applicationId: activeApp?.id,
      });

      setLinks((prev) => [created, ...prev]);
      setRecentlyCreatedLink(created);
      setViewMode('list');
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

  // The public checkout is hosted by the payment provider; no simulated preview is shown here.
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
            Configurez le produit, le montant et les options de paiement.
          </p>
        </div>

        <div className="pf-payment-link-studio" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="pf-saspay-card" style={{ padding: '1.75rem' }}>
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
                    placeholder="Ex: Licence Pro PitchFlow, Formation Growth..."
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
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
                        min={PAYDUNYA_MINIMUM_AMOUNT_XOF}
                        step="1"
                        required
                      />
                    </div>
                  )}

                  {amountType === 'fixed' && (
                    <div className="pf-form-group">
                      <label className="pf-label">Devise</label>
                      <select
                        className="pf-select"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        <option value="XOF">XOF (FCFA)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Personnalisation & Frais */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                    2. Frais & Expérience client
                  </span>
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">Pays par défaut</label>
                  <select
                    className="pf-select"
                    value={defaultCountry}
                    onChange={(e) => setDefaultCountry(e.target.value)}
                  >
                    <option value="">Laisser le client choisir</option>
                    {SUPPORTED_COUNTRIES.filter((c) => c.code === 'BJ').map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.dialCode}) — {c.currency}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="pf-form-group" role="note">
                  Aucun frais supplémentaire n’est ajouté au montant demandé. Les frais éventuels ne sont pas présumés.
                </p>

                <div className="pf-form-group" style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                        Demander le numéro de téléphone de contact
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                        Facultatif. Le numéro utilisé ensuite pour le paiement mobile est saisi séparément sur la page de paiement sécurisée.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={requirePhone}
                      onChange={(e) => setRequirePhone(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem', accentColor: '#5E30E8', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>

              {/* Section 3: URL & Limites */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                    3. Expiration et options
                  </span>
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">Date d’expiration (optionnelle)</label>
                  <input
                    type="date"
                    className="pf-input"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
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

      {recentlyCreatedLink && (
        <div className="pf-saspay-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Lien de paiement créé</div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href={recentlyCreatedLink.paymentUrl || `${window.location.origin}/pay/${recentlyCreatedLink.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'monospace', overflowWrap: 'anywhere', flex: 1 }}
            >
              {recentlyCreatedLink.paymentUrl || `${window.location.origin}/pay/${recentlyCreatedLink.slug}`}
            </a>
            <button
              type="button"
              className="pf-btn pf-btn-primary pf-btn-sm"
              onClick={() => copyPublicUrl(recentlyCreatedLink.slug, undefined, recentlyCreatedLink.paymentUrl)}
            >
              <FontAwesomeIcon icon={copiedSlug === recentlyCreatedLink.slug ? faCheck : faCopy} />
              <span>{copiedSlug === recentlyCreatedLink.slug ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="pf-saspay-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
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
        <div className="pf-saspay-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
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
        <div className="pf-saspay-table-wrapper" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="pf-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="pf-saspay-table" style={{ width: '100%', minWidth: '600px' }}>
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
                          {link.paymentUrl || `${window.location.origin}/pay/${link.slug}`}
                        </span>
                        <button
                          onClick={(e) => copyPublicUrl(link.slug, e, link.paymentUrl)}
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
                          href={link.paymentUrl || `/pay/${link.slug}`}
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
                  {selectedLink.paymentUrl || `${window.location.origin}/pay/${selectedLink.slug}`}
                </span>{' '}
                <button
                  onClick={() => copyPublicUrl(selectedLink.slug, undefined, selectedLink.paymentUrl)}
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
              {selectedLink.expiresAt && (
                <div><strong>Expire le :</strong> {new Date(selectedLink.expiresAt).toLocaleDateString('fr-FR')}</div>
              )}
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
                    min={PAYDUNYA_MINIMUM_AMOUNT_XOF}
                    required
                  />
                </div>
              )}

              <div className="pf-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={editRequirePhone}
                    onChange={(e) => setEditRequirePhone(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem' }}
                  />
                  <span>Exiger le numéro de téléphone</span>
                </label>
              </div>

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
