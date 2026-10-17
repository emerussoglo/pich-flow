import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faEye,
  faRotate,
  faArrowLeft,
  faCheck,
  faCopy,
  faXmark,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { useRouter } from '../../lib/router';
import { apiClient } from '../../lib/api';

import { Application } from '../../types';

export const WebhookLogsView: React.FC<{ appName?: string; activeApp?: Application }> = ({
  appName = 'Mon Application',
  activeApp,
}) => {
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.developer.getWebhookLogs(activeApp?.id);
      setLogs(res.logs || []);
    } catch {
      showToast('Impossible de charger le journal des webhooks.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <button
            onClick={() => navigate('/dashboard/webhooks')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '0.5rem',
              padding: 0,
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Retour aux endpoints webhooks</span>
          </button>
          <h1 className="pf-page-title">Journal des livraisons Webhooks</h1>
          <p className="pf-page-subtitle">
            Historique réel des requêtes transmises avec statut HTTP, payload et temps de réponse pour {appName}.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="pf-btn pf-btn-secondary pf-btn-sm"
          title="Actualiser le journal"
        >
          <FontAwesomeIcon icon={faRotate} spin={isLoading} />
          <span>Actualiser</span>
        </button>
      </div>

      {logs.length === 0 ? (
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
            <FontAwesomeIcon icon={faListCheck} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Aucune tentative de livraison pour le moment
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Le journal des webhooks s'enrichira automatiquement dès que des événements de transaction ou des tests de transmission seront déclenchés.
          </p>
          <button
            onClick={() => navigate('/dashboard/webhooks')}
            className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
          >
            <span>Gérer mes endpoints</span>
          </button>
        </div>
      ) : (
        <div className="pf-ui-table-wrapper">
          <div className="pf-table-scroll">
            <table className="pf-ui-table">
              <thead>
                <tr>
                  <th>DATE & HEURE</th>
                  <th>ÉVÉNEMENT</th>
                  <th>DESTINATION</th>
                  <th>STATUT HTTP</th>
                  <th>LATENCE</th>
                  <th style={{ textAlign: 'right' }}>PAYLOAD</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                        {new Date(log.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                        {log.event}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.8125rem' }}>
                        {log.url || 'Endpoint'}
                      </span>
                    </td>
                    <td>
                      <span className={`pf-pill-status ${log.status === 200 ? 'reussi' : 'echoue'}`}>
                        {log.status} {log.statusText}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                        {log.durationMs} ms
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        style={{
                          background: '#F1F5F9',
                          border: 'none',
                          color: '#475569',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        title="Consulter le payload JSON"
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

      {/* Payload Modal */}
      {selectedLog && (
        <div className="pf-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Détails de la requête : {selectedLog.event}</h3>
              <button onClick={() => setSelectedLog(null)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '0.35rem' }}>
                Payload transmis au webhook (JSON signé) :
              </div>
              <pre
                style={{
                  background: '#0F172A',
                  color: '#38BDF8',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  maxHeight: '220px',
                }}
              >
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '0.35rem' }}>
                Réponse renvoyée par le serveur distant :
              </div>
              <pre
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  color: '#1E293B',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                }}
              >
                {selectedLog.response}
              </pre>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="pf-btn pf-btn-secondary pf-btn-md"
              style={{ width: '100%' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
