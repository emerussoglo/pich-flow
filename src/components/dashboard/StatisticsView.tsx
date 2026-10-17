import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartPie, faCalendarDays, faRotate, faGlobe, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { apiClient } from '../../lib/api';
import { Application, Transaction } from '../../types';
import { useToast } from '../ui/ToastContext';

interface StatisticsViewProps {
  appName?: string;
  activeApp?: Application;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  appName = 'Mon Application',
  activeApp,
}) => {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<'7j' | '30j' | '90j'>('30j');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const transactionsRequestId = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++transactionsRequestId.current;
    setIsLoading(true);
    setTransactions([]);
    if (!activeApp?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiClient.transactions.getAll(activeApp.id);
      if (requestId !== transactionsRequestId.current) return;
      setTransactions(data || []);
    } catch {
      if (requestId !== transactionsRequestId.current) return;
      setTransactions([]);
      showToast('Impossible de charger les statistiques.', 'error');
    } finally {
      if (requestId === transactionsRequestId.current) setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    const days = period === '7j' ? 7 : period === '30j' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      return txDate >= cutoff;
    });
  }, [transactions, period]);

  // Real calculations
  const totalCount = periodTransactions.length;
  const successfulList = periodTransactions.filter(
    (t) => t.status === 'completed' || t.status === 'success'
  );
  const failedList = periodTransactions.filter(
    (t) => t.status === 'failed'
  );
  const pendingList = periodTransactions.filter(
    (t) => t.status === 'pending'
  );

  const successCount = successfulList.length;
  const failedCount = failedList.length;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';

  // Total revenue from successful transactions strictly
  const totalRevenue = successfulList.reduce((acc, t) => acc + (t.netAmount || t.amount || 0), 0);

  // Breakdown by country
  const countryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; volume: number }> = {};
    for (const t of successfulList) {
      const c = t.country || 'BJ';
      if (!map[c]) map[c] = { count: 0, volume: 0 };
      map[c].count += 1;
      map[c].volume += t.amount;
    }
    return Object.entries(map).map(([country, data]) => ({ country, ...data }));
  }, [successfulList]);

  // Breakdown by payment provider / method
  const methodBreakdown = useMemo(() => {
    const map: Record<string, { count: number; volume: number }> = {};
    for (const t of successfulList) {
      const m = t.provider || t.paymentMethod || 'Mobile Money';
      if (!map[m]) map[m] = { count: 0, volume: 0 };
      map[m].count += 1;
      map[m].volume += t.amount;
    }
    return Object.entries(map).map(([method, data]) => ({ method, ...data }));
  }, [successfulList]);

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Statistiques de performance</h1>
          <p className="pf-page-subtitle">
            Analyse des revenus réels et des transactions de {appName} calculés depuis la base de données.
          </p>
        </div>

        <button
          onClick={loadData}
          className="pf-btn pf-btn-secondary pf-btn-sm"
          title="Actualiser les statistiques"
        >
          <FontAwesomeIcon icon={faRotate} spin={isLoading} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Period Filter Card */}
      <div className="pf-ui-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>
            <FontAwesomeIcon icon={faCalendarDays} style={{ color: '#64748B' }} />
            <span>Période d'analyse</span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['7j', '30j', '90j'] as const).map((p) => {
              const label = p === '7j' ? '7 derniers jours' : p === '30j' ? '30 derniers jours' : '90 derniers jours';
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '0.4rem 0.95rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: active ? '#2563EB' : '#F1F5F9',
                    color: active ? '#FFFFFF' : '#475569',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>
          {totalCount} transaction(s) analysée(s)
        </div>
      </div>

      {/* 4 KPI Cards (Dynamic Calculations) */}
      <div className="pf-stats-kpi-grid">
        <div className="pf-stat-kpi-card">
          <div className="pf-kpi-label">Total des transactions</div>
          <div className="pf-kpi-value">{totalCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            Sur les {period === '7j' ? '7' : period === '30j' ? '30' : '90'} derniers jours
          </div>
        </div>

        <div className="pf-stat-kpi-card green">
          <div className="pf-kpi-label">Transactions réussies</div>
          <div className="pf-kpi-value" style={{ color: '#166534' }}>{successCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.25rem' }}>
            Volume : {totalRevenue.toLocaleString('fr-FR')} XOF
          </div>
        </div>

        <div className="pf-stat-kpi-card pink">
          <div className="pf-kpi-label">Transactions échouées</div>
          <div className="pf-kpi-value" style={{ color: '#991B1B' }}>{failedCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#991B1B', marginTop: '0.25rem' }}>
            {pendingList.length > 0 ? `${pendingList.length} en attente` : '0 en attente'}
          </div>
        </div>

        <div className="pf-stat-kpi-card yellow">
          <div className="pf-kpi-label">Taux de conversion / réussite</div>
          <div className="pf-kpi-value" style={{ color: '#854D0E' }}>
            {totalCount > 0 ? `${successRate}%` : '0%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#854D0E', marginTop: '0.25rem' }}>
            {totalCount > 0 ? `${successCount} sur ${totalCount} validées` : 'Aucun paiement'}
          </div>
        </div>
      </div>

      {/* Graphs & Breakdowns */}
      <div className="pf-responsive-grid-2" style={{ marginTop: '1.5rem', gap: '1.25rem' }}>
        {/* Breakdown by Country */}
        <div className="pf-ui-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '1.25rem' }}>
            <FontAwesomeIcon icon={faGlobe} style={{ color: '#2563EB' }} />
            <span>Répartition des encaissements par pays</span>
          </div>

          {countryBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748B', fontSize: '0.8125rem' }}>
              Aucune donnée pour cette période. Vos paiements confirmés apparaîtront ici par pays.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {countryBreakdown.map((item) => {
                const pct = totalRevenue > 0 ? ((item.volume / totalRevenue) * 100).toFixed(0) : '0';
                return (
                  <div key={item.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.country} ({item.count} paiement(s))</span>
                      <strong>{item.volume.toLocaleString('fr-FR')} XOF ({pct}%)</strong>
                    </div>
                    <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#2563EB' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown by Payment Method */}
        <div className="pf-ui-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '1.25rem' }}>
            <FontAwesomeIcon icon={faCreditCard} style={{ color: '#16A34A' }} />
            <span>Répartition par moyen de paiement</span>
          </div>

          {methodBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748B', fontSize: '0.8125rem' }}>
              Aucune donnée pour cette période. Les volumes par réseau Mobile Money ou carte s'afficheront ici.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {methodBreakdown.map((item) => {
                const pct = totalRevenue > 0 ? ((item.volume / totalRevenue) * 100).toFixed(0) : '0';
                return (
                  <div key={item.method}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.method} ({item.count})</span>
                      <strong>{item.volume.toLocaleString('fr-FR')} XOF ({pct}%)</strong>
                    </div>
                    <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#16A34A' }} />
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
