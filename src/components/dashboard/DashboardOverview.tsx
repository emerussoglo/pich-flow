import React from 'react';
import { Transaction, Application, Wallet } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet,
  faPlus,
  faArrowUpRightFromSquare,
  faCircleArrowDown,
  faReceipt,
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from '../../lib/router';

interface DashboardOverviewProps {
  activeApp: Application;
  transactions: Transaction[];
  wallets: Wallet[];
  onOpenCreateLinkModal?: () => void;
  onOpenWithdrawalModal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

const DEFAULT_CURRENCIES = ['XOF', 'XAF', 'USD', 'NGN', 'GHS', 'GNF'];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  activeApp,
  transactions,
  wallets,
  onOpenWithdrawalModal,
}) => {
  const { navigate } = useRouter();

  // Compute actual balances by currency from real user wallets
  const walletMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of wallets) {
      map[w.currency] = (map[w.currency] || 0) + (w.balance || 0);
    }
    return map;
  }, [wallets]);

  // Display currencies: real active user currencies first, followed by default currencies with 0
  const displayCurrencies = React.useMemo(() => {
    const list: { code: string; amount: number; highlight?: boolean }[] = [];
    const seen = new Set<string>();

    for (const w of wallets) {
      if (!seen.has(w.currency)) {
        seen.add(w.currency);
        list.push({
          code: w.currency,
          amount: walletMap[w.currency] || 0,
          highlight: w.isDefault,
        });
      }
    }

    for (const c of DEFAULT_CURRENCIES) {
      if (!seen.has(c)) {
        seen.add(c);
        list.push({
          code: c,
          amount: 0,
          highlight: false,
        });
      }
    }

    return list;
  }, [wallets, walletMap]);

  // Real recent transactions (limit 6)
  const recentTransactions = transactions.slice(0, 6);

  return (
    <div>
      {/* Page Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Tableau de bord</h1>
          <p className="pf-page-subtitle">
            Vue d'ensemble de {activeApp.name} — suivi en temps réel des encaissements et soldes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (onOpenWithdrawalModal) onOpenWithdrawalModal();
              else navigate('/dashboard/withdrawals');
            }}
            className="pf-btn-action-secondary"
          >
            <FontAwesomeIcon icon={faCircleArrowDown} />
            <span>Retirer</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/create-payment-link')}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            <span>Créer un lien de paiement</span>
          </button>
        </div>
      </div>

      {/* 2-Column Grid (Solde disponible + Transactions récentes) */}
      <div className="pf-overview-2col-grid">
        {/* Left Card: Solde disponible */}
        <div className="pf-saspay-card">
          <div className="pf-card-head-between">
            <div className="pf-card-head-title">
              <FontAwesomeIcon icon={faWallet} style={{ color: '#2563EB' }} />
              <span>Solde disponible par devise</span>
            </div>
            <span
              onClick={() => navigate('/dashboard/wallets')}
              className="pf-card-head-link"
              style={{ cursor: 'pointer' }}
            >
              Voir le wallet →
            </span>
          </div>

          <div className="pf-currency-balance-grid">
            {displayCurrencies.map((item) => (
              <div key={item.code} className="pf-currency-cell">
                <div className="pf-currency-code">{item.code}</div>
                <div
                  className="pf-currency-amount"
                  style={{
                    color: item.amount > 0 ? '#16A34A' : item.highlight ? '#0F172A' : '#64748B',
                    fontWeight: item.amount > 0 ? 800 : 600,
                  }}
                >
                  {item.amount.toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Transactions récentes */}
        <div className="pf-saspay-card">
          <div className="pf-card-head-between">
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
              Transactions récentes ({transactions.length})
            </span>
            <span
              onClick={() => navigate('/dashboard/transactions')}
              className="pf-card-head-link"
              style={{ cursor: 'pointer' }}
            >
              Tout voir →
            </span>
          </div>

          {recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748B' }}>
              <div
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                  fontSize: '1.25rem',
                }}
              >
                <FontAwesomeIcon icon={faReceipt} />
              </div>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Aucune transaction récente
              </div>
              <div style={{ fontSize: '0.8125rem', maxWidth: '320px', margin: '0 auto 1rem' }}>
                Vos paiements apparaîtront ici dès que vos clients auront commencé à régler via vos liens ou l'API.
              </div>
              <button
                onClick={() => navigate('/dashboard/create-payment-link')}
                className="pf-btn pf-btn-secondary pf-btn-sm"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Créer un premier lien</span>
              </button>
            </div>
          ) : (
            <div className="pf-recent-tx-list">
              {recentTransactions.map((tx) => {
                const isSuccess = tx.status === 'completed' || tx.status === 'success';
                const isFailed = tx.status === 'failed';
                return (
                  <div key={tx.id} className="pf-recent-tx-row">
                    <div className="pf-recent-tx-left">
                      <div className={`pf-recent-tx-icon-circle ${isSuccess ? 'success' : isFailed ? 'failed' : ''}`}>
                        <FontAwesomeIcon icon={faPlus} />
                      </div>
                      <div className="pf-recent-tx-info">
                        <div className="pf-recent-tx-ref" title={tx.reference || tx.id}>
                          {(tx.reference || tx.id).substring(0, 18)}...
                        </div>
                        <div className="pf-recent-tx-date">
                          {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pf-recent-tx-right">
                      <div
                        className={`pf-recent-tx-amount ${isSuccess ? 'success' : ''}`}
                        style={{ color: isSuccess ? '#16A34A' : '#0F172A' }}
                      >
                        +{Number(tx.amount).toLocaleString('fr-FR')} {tx.currency || 'XOF'}
                      </div>
                      <div style={{ marginTop: '0.2rem' }}>
                        <span
                          className={`pf-pill-status ${
                            isSuccess ? 'reussi' : isFailed ? 'echoue' : 'en_attente'
                          }`}
                        >
                          {isSuccess ? 'Réussi' : isFailed ? 'Échoué' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
