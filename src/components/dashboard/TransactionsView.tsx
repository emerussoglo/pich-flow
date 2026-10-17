import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload,
  faEye,
  faSearch,
  faXmark,
  faRotate,
  faReceipt,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { Application, Transaction } from '../../types';

interface TransactionsViewProps {
  appName?: string;
  activeApp?: Application;
  transactions?: Transaction[];
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  appName = 'Mon Application',
  activeApp,
  transactions: initialTransactions,
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Tous' | 'completed' | 'pending' | 'failed' | 'cancelled'>('Tous');
  const [directionFilter, setDirectionFilter] = useState<'Tous' | 'in' | 'out'>('Tous');
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [networkFilter, setNetworkFilter] = useState<string>('Tous');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions || []);
  const [isLoading, setIsLoading] = useState(!initialTransactions);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.transactions.getAll(activeApp?.id);
      setTransactions(data || []);
    } catch {
      showToast('Impossible de charger les transactions.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = transactions.filter((tx) => {
    // Status filter
    if (statusFilter !== 'Tous' && tx.status !== statusFilter) {
      return false;
    }
    // Direction filter
    if (directionFilter === 'in' && tx.type !== 'charge' && tx.type !== 'payin') {
      return false;
    }
    if (directionFilter === 'out' && tx.type !== 'payout' && tx.type !== 'transfer') {
      return false;
    }
    // Country filter
    if (countryFilter !== 'Tous' && tx.country !== countryFilter) {
      return false;
    }
    // Network filter
    if (networkFilter !== 'Tous') {
      const prov = (tx.provider || tx.paymentMethod || '').toLowerCase();
      if (!prov.includes(networkFilter.toLowerCase())) return false;
    }
    // Search query
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = tx.id.toLowerCase().includes(term);
      const matchRef = tx.reference && tx.reference.toLowerCase().includes(term);
      const matchPhone = tx.customerPhone && tx.customerPhone.toLowerCase().includes(term);
      const matchDesc = tx.description && tx.description.toLowerCase().includes(term);
      if (!matchId && !matchRef && !matchPhone && !matchDesc) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    try {
      if (filtered.length === 0) {
        showToast('Aucune transaction à exporter avec ces critères.', 'warning');
        return;
      }
      const headers = ['ID', 'Référence', 'Type', 'Montant', 'Devise', 'Pays', 'Moyen_Paiement', 'Statut', 'Date', 'Client_Tel'];
      const rows = filtered.map((tx) => [
        tx.id,
        tx.reference || tx.id,
        tx.type || 'Paiement',
        tx.amount,
        tx.currency || 'XOF',
        tx.country || 'BJ',
        tx.provider || tx.paymentMethod || 'Mobile Money',
        tx.status,
        tx.createdAt,
        tx.customerPhone || '',
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `pichflow_transactions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Export de ${filtered.length} transaction(s) généré !`, 'success');
    } catch {
      showToast("Échec de l'exportation CSV.", 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <span className="pf-pill-status reussi">Réussi</span>;
      case 'pending':
        return <span className="pf-pill-status en_attente">En attente</span>;
      case 'cancelled':
        return <span className="pf-pill-status annule">Annulé</span>;
      case 'failed':
      default:
        return <span className="pf-pill-status echoue">Échoué</span>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Historique des transactions</h1>
          <p className="pf-page-subtitle">
            Flux financiers réels et traçabilité comptable pour {appName}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadTransactions}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les transactions"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="pf-btn-action-primary"
            style={{ background: '#0F172A' }}
          >
            <FontAwesomeIcon icon={faDownload} />
            <span>Exporter CSV ({filtered.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="pf-saspay-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {/* Search */}
          <div>
            <label className="pf-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Recherche</label>
            <div className="pf-input-wrapper">
              <span className="pf-input-icon">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                className="pf-input pf-input-with-icon"
                placeholder="Réf., téléphone, libellé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="pf-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Statut</label>
            <select
              className="pf-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="Tous">Tous les statuts</option>
              <option value="completed">Réussi</option>
              <option value="pending">En attente</option>
              <option value="failed">Échoué</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="pf-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Sens du flux</label>
            <select
              className="pf-select"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
            >
              <option value="Tous">Tous (Entrant & Sortant)</option>
              <option value="in">Entrant (Encaissements)</option>
              <option value="out">Sortant (Reversements)</option>
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="pf-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Pays</label>
            <select
              className="pf-select"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
            >
              <option value="Tous">Tous les pays</option>
              <option value="BJ">Bénin (BJ)</option>
              <option value="CI">Côte d'Ivoire (CI)</option>
              <option value="SN">Sénégal (SN)</option>
              <option value="TG">Togo (TG)</option>
              <option value="BF">Burkina Faso (BF)</option>
              <option value="CM">Cameroun (CM)</option>
            </select>
          </div>

          {/* Network */}
          <div>
            <label className="pf-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Réseau</label>
            <select
              className="pf-select"
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
            >
              <option value="Tous">Tous les réseaux</option>
              <option value="MTN">MTN Mobile Money</option>
              <option value="Moov">Moov Money</option>
              <option value="Orange">Orange Money</option>
              <option value="Wave">Wave</option>
              <option value="Card">Carte Bancaire</option>
            </select>
          </div>
        </div>
      </div>

      {/* Real Data vs Empty State */}
      {filtered.length === 0 ? (
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
            <FontAwesomeIcon icon={faReceipt} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Aucune transaction pour le moment
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Vos transactions réelles apparaîtront ici dès que vos clients auront commencé à payer via vos liens de paiement ou l'API de {appName}.
          </p>
        </div>
      ) : (
        <div className="pf-saspay-table-wrapper">
          <div className="pf-table-scroll">
            <table className="pf-saspay-table">
              <thead>
                <tr>
                  <th>RÉFÉRENCE & DATE</th>
                  <th>TYPE & SENS</th>
                  <th>PAYS & RÉSEAU</th>
                  <th>CLIENT / TÉLÉPHONE</th>
                  <th>STATUT</th>
                  <th style={{ textAlign: 'right' }}>MONTANT NET</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', fontSize: '0.8125rem' }}>
                          {tx.reference || tx.id}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                          {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.8125rem' }}>
                          {tx.type === 'charge' || tx.type === 'payin' ? 'Encaissement' : 'Reversement'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {tx.description || 'Paiement client'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className="pf-pill-currency" style={{ marginRight: '6px' }}>{tx.country || 'BJ'}</span>
                        <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500 }}>
                          {tx.provider || tx.paymentMethod || 'Mobile Money'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.8125rem' }}>
                        {tx.customerPhone || '—'}
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(tx.status)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontSize: '0.9rem',
                          color: tx.status === 'completed' || tx.status === 'success' ? '#16A34A' : '#0F172A',
                        }}
                      >
                        {tx.type === 'charge' || tx.type === 'payin' ? '+' : '-'}
                        {Number(tx.amount).toLocaleString('fr-FR')} {tx.currency || 'XOF'}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedTx(tx)}
                        style={{
                          background: '#F1F5F9',
                          border: 'none',
                          color: '#475569',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        title="Détails de la transaction"
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="pf-modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Détails de la transaction</h3>
              <button onClick={() => setSelectedTx(null)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', lineHeight: '1.8', fontSize: '0.875rem' }}>
              <div><strong>Identifiant :</strong> <span style={{ fontFamily: 'monospace' }}>{selectedTx.id}</span></div>
              <div><strong>Référence PayDunya / PichFlow :</strong> <span style={{ fontFamily: 'monospace' }}>{selectedTx.reference || selectedTx.id}</span></div>
              <div><strong>Montant brut :</strong> {Number(selectedTx.amount).toLocaleString('fr-FR')} {selectedTx.currency || 'XOF'}</div>
              <div><strong>Frais PayDunya :</strong> {selectedTx.feesConfirmed ? `${Number(selectedTx.providerFee || 0).toLocaleString('fr-FR')} ${selectedTx.currency || 'XOF'}` : 'Non confirmés par l’API'}</div>
              <div><strong>Montant net :</strong> {selectedTx.feesConfirmed && selectedTx.netAmount !== null ? `${Number(selectedTx.netAmount).toLocaleString('fr-FR')} ${selectedTx.currency || 'XOF'}` : 'Non calculable faute de frais confirmés'}</div>
              <div><strong>Réseau & Fournisseur :</strong> {selectedTx.provider || selectedTx.paymentMethod || 'Mobile Money'}</div>
              <div><strong>Pays :</strong> {selectedTx.country || 'BJ'}</div>
              <div><strong>Téléphone client :</strong> {selectedTx.customerPhone || 'Non renseigné'}</div>
              <div><strong>Statut :</strong> {selectedTx.status}</div>
              <div>
                <strong>Date & heure :</strong>{' '}
                {new Date(selectedTx.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <button
                onClick={() => setSelectedTx(null)}
                className="pf-btn pf-btn-secondary pf-btn-md"
                style={{ width: '100%' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
