import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRotate,
  faXmark,
  faCheck,
  faArrowRightArrowLeft,
  faPlus,
  faWallet,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { Wallet } from '../../types';

interface WalletsViewProps {
  appName?: string;
  wallets?: Wallet[];
  ledgerEntries?: any[];
  onOpenWithdrawalModal?: () => void;
}

const SUPPORTED_COUNTRIES = [
  { countryCode: 'BJ', countryName: 'Bénin', currency: 'XOF', symbol: 'FCFA' },
  { countryCode: 'CI', countryName: "Côte d'Ivoire", currency: 'XOF', symbol: 'FCFA' },
  { countryCode: 'SN', countryName: 'Sénégal', currency: 'XOF', symbol: 'FCFA' },
  { countryCode: 'TG', countryName: 'Togo', currency: 'XOF', symbol: 'FCFA' },
  { countryCode: 'BF', countryName: 'Burkina Faso', currency: 'XOF', symbol: 'FCFA' },
  { countryCode: 'CM', countryName: 'Cameroun', currency: 'XAF', symbol: 'FCFA' },
  { countryCode: 'NG', countryName: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { countryCode: 'GH', countryName: 'Ghana', currency: 'GHS', symbol: 'GH₵' },
  { countryCode: 'US', countryName: 'International (USD)', currency: 'USD', symbol: '$' },
];

export const WalletsView: React.FC<WalletsViewProps> = ({ appName = 'Mon Application', onOpenWithdrawalModal }) => {
  const { showToast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('1000');
  const [isTransferring, setIsTransferring] = useState(false);

  // Add wallet modal
  const [addWalletModalOpen, setAddWalletModalOpen] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState('CI');
  const [isAdding, setIsAdding] = useState(false);

  const loadWallets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.wallets.getAll();
      setWallets(data || []);
      if (data && data.length > 0) {
        if (!fromWalletId) setFromWalletId(data[0].id);
        if (!toWalletId && data.length > 1) setToWalletId(data[1].id);
      }
    } catch {
      showToast('Impossible de charger les portefeuilles.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, fromWalletId, toWalletId]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      showToast('Veuillez saisir un montant valide et strictement positif.', 'error');
      return;
    }

    if (fromWalletId === toWalletId) {
      showToast('Les portefeuilles source et destination doivent être différents.', 'error');
      return;
    }

    const source = wallets.find((w) => w.id === fromWalletId);
    if (source && source.balance < amount) {
      showToast(`Solde insuffisant (${source.balance} ${source.currency} disponible).`, 'error');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await apiClient.wallets.transfer({
        fromWalletId,
        toWalletId,
        amount,
      });

      showToast(res.message || 'Transfert inter-portefeuilles réussi !', 'success');
      setTransferModalOpen(false);
      await loadWallets();
    } catch (err: any) {
      showToast(err.message || 'Échec du transfert entre portefeuilles.', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const match = SUPPORTED_COUNTRIES.find((c) => c.countryCode === selectedCountryCode);
    if (!match) return;

    setIsAdding(true);
    try {
      await apiClient.wallets.create({
        countryCode: match.countryCode,
        currency: match.currency,
        symbol: match.symbol,
      });
      showToast(`Portefeuille ${match.countryName} (${match.currency}) activé avec succès.`, 'success');
      setAddWalletModalOpen(false);
      await loadWallets();
    } catch (err: any) {
      showToast(err.message || 'Impossible d’activer ce portefeuille.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const getCountryName = (code: string) => {
    const match = SUPPORTED_COUNTRIES.find((c) => c.countryCode === code);
    return match ? match.countryName : code;
  };

  // Total balance across wallets in XOF equivalent
  const totalBalance = wallets.reduce((acc, w) => acc + (w.currency === 'XOF' ? w.balance : 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Portefeuilles (Wallets)</h1>
          <p className="pf-page-subtitle">
            Gérez vos soldes et devises par pays pour {appName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadWallets}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les soldes"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => setAddWalletModalOpen(true)}
            className="pf-btn pf-btn-secondary pf-btn-sm"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Activer un pays</span>
          </button>
          <button
            onClick={() => {
              if (wallets.length < 2) {
                showToast('Vous devez posséder au moins 2 portefeuilles pour effectuer un transfert.', 'info');
                setAddWalletModalOpen(true);
              } else {
                setTransferModalOpen(true);
              }
            }}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faArrowRightArrowLeft} />
            <span>Transférer des fonds</span>
          </button>
        </div>
      </div>

      {/* Overview Banner */}
      <div
        className="pf-saspay-card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Solde total disponible (XOF)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {totalBalance.toLocaleString('fr-FR')} FCFA
          </div>
          <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginTop: '0.25rem' }}>
            {wallets.length} portefeuille(s) actif(s) sur votre compte marchand
          </div>
        </div>

        {onOpenWithdrawalModal && (
          <button
            onClick={onOpenWithdrawalModal}
            className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
          >
            <span>Demander un reversement</span>
          </button>
        )}
      </div>

      {/* Grid of Real Wallets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {wallets.map((w) => (
          <div
            key={w.id}
            className="pf-saspay-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: w.isDefault ? '2px solid #2563EB' : '1px solid #E2E8F0',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '10px',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.875rem',
                    }}
                  >
                    {w.countryCode}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
                      {getCountryName(w.countryCode)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Devise : {w.currency} ({w.symbol})
                    </div>
                  </div>
                </div>

                {w.isDefault && (
                  <span className="pf-pill-status actif" style={{ fontSize: '0.7rem' }}>
                    Principal
                  </span>
                )}
              </div>

              <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Solde disponible</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
                  {w.balance.toLocaleString('fr-FR')} {w.currency}
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B' }}>
              <span>En attente : {w.pendingBalance.toLocaleString('fr-FR')}</span>
              <span>Réservé : {w.reservedBalance.toLocaleString('fr-FR')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL 1: TRANSFERT DE FONDS */}
      {transferModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setTransferModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Transfert inter-portefeuilles</h3>
              <button onClick={() => setTransferModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit}>
              <div className="pf-form-group">
                <label className="pf-label">Portefeuille source (à débiter)</label>
                <select
                  className="pf-select"
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {getCountryName(w.countryCode)} ({w.balance.toLocaleString('fr-FR')} {w.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Portefeuille cible (à créditer)</label>
                <select
                  className="pf-select"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === fromWalletId}>
                      {getCountryName(w.countryCode)} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Montant à transférer</label>
                <input
                  type="number"
                  className="pf-input"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isTransferring ? 'Transfert...' : 'Confirmer le transfert'}</span>
                  <FontAwesomeIcon icon={faCheck} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ACTIVER UN PORTFEUILLE PAYS */}
      {addWalletModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setAddWalletModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Activer un nouveau portefeuille pays</h3>
              <button onClick={() => setAddWalletModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleAddWalletSubmit}>
              <div className="pf-form-group">
                <label className="pf-label">Pays et devise d'encaissement</label>
                <select
                  className="pf-select"
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                >
                  {SUPPORTED_COUNTRIES.map((c) => {
                    const alreadyHas = wallets.some((w) => w.countryCode === c.countryCode);
                    return (
                      <option key={c.countryCode} value={c.countryCode} disabled={alreadyHas}>
                        {c.countryName} ({c.currency} - {c.symbol}) {alreadyHas ? '✓ Déjà actif' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAddWalletModalOpen(false)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isAdding ? 'Activation...' : 'Activer le portefeuille'}</span>
                  <FontAwesomeIcon icon={faCheck} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
