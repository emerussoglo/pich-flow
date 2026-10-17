import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleNodes,
  faPlus,
  faRotate,
  faTrash,
  faPaperPlane,
  faCheck,
  faCopy,
  faClock,
  faShieldHalved,
  faXmark,
  faPowerOff,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { useRouter } from '../../lib/router';
import { apiClient } from '../../lib/api';
import { Application, WebhookEndpoint } from '../../types';

const WEBHOOK_EVENT_TYPES = [
  { id: 'transaction.created', label: 'Transaction créée', desc: 'Déclenché dès qu’une intention de paiement est initiée' },
  { id: 'transaction.success', label: 'Transaction réussie', desc: 'Déclenché quand le client a payé avec succès' },
  { id: 'transaction.failed', label: 'Transaction échouée', desc: 'Déclenché en cas d’échec ou d’abandon de paiement' },
  { id: 'withdrawal.requested', label: 'Retrait demandé', desc: 'Déclenché lors de la création d’une demande de retrait' },
  { id: 'withdrawal.success', label: 'Retrait réussi', desc: 'Déclenché quand les fonds sont arrivés sur le compte du bénéficiaire' },
];

export const WebhooksView: React.FC<{ appName?: string; activeApp?: Application }> = ({
  appName = 'Mon Application',
  activeApp,
}) => {
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTestingId, setIsTestingId] = useState<string | null>(null);

  // Form states
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'transaction.success',
    'transaction.failed',
  ]);
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.developer.getWebhooks(activeApp?.id);
      setWebhooks(data || []);
    } catch {
      showToast('Impossible de charger les webhooks.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim().startsWith('http')) {
      showToast('L’URL doit être absolue et débuter par https:// ou http://', 'error');
      return;
    }

    try {
      const created = await apiClient.developer.addWebhook({
        url: url.trim(),
        description: description.trim() || 'Endpoint API',
        applicationId: activeApp?.id,
      });
      setWebhooks((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      setUrl('');
      setDescription('');
      showToast('Nouveau webhook configuré avec succès !', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la configuration du webhook.', 'error');
    }
  };

  const handleToggleActive = async (wh: WebhookEndpoint) => {
    try {
      await apiClient.developer.updateWebhook(wh.id, { isActive: !wh.isActive });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === wh.id ? { ...w, isActive: !w.isActive } : w))
      );
      showToast(
        wh.isActive ? 'Webhook désactivé temporairement.' : 'Webhook réactivé.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Impossible de modifier le statut.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet endpoint webhook ?')) return;
    try {
      await apiClient.developer.deleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      showToast('Webhook supprimé.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer le webhook.', 'error');
    }
  };

  const handleTestPing = async (id: string) => {
    setIsTestingId(id);
    try {
      const res = await apiClient.developer.testWebhook(id);
      showToast(res.message || 'Ping de test délivré avec succès !', 'success');
      await loadWebhooks();
    } catch (err: any) {
      showToast(err.message || 'Échec du test de livraison.', 'error');
    } finally {
      setIsTestingId(null);
    }
  };

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecretId(id);
    showToast('Secret de signature copié !', 'info');
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Webhooks & Notifications API</h1>
          <p className="pf-page-subtitle">
            Recevez des notifications HTTP signées en temps réel sur les événements de {appName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/dashboard/webhook-logs')}
            className="pf-btn pf-btn-secondary pf-btn-sm"
          >
            <FontAwesomeIcon icon={faClock} />
            <span>Journal des livraisons</span>
          </button>
          <button
            onClick={loadWebhooks}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Ajouter un endpoint</span>
          </button>
        </div>
      </div>

      {/* List vs Empty State */}
      {webhooks.length === 0 ? (
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
            <FontAwesomeIcon icon={faCircleNodes} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Aucun webhook configuré pour le moment
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Ajoutez l'URL de votre serveur pour être notifié automatiquement des paiements réussis et des demandes de retrait.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Configurer un webhook</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="pf-ui-card"
              style={{
                padding: '1.25rem',
                borderLeft: wh.isActive ? '4px solid #2563EB' : '4px solid #CBD5E1',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
                      {wh.url}
                    </span>
                    <span className={`pf-pill-status ${wh.isActive ? 'actif' : 'inactif'}`}>
                      {wh.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </div>
                  {wh.description && (
                    <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                      {wh.description}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleTestPing(wh.id)}
                    disabled={isTestingId === wh.id}
                    className="pf-btn pf-btn-secondary pf-btn-sm"
                    title="Envoyer un ping de test"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} spin={isTestingId === wh.id} />
                    <span>Tester le ping</span>
                  </button>
                  <button
                    onClick={() => handleToggleActive(wh)}
                    className="pf-btn pf-btn-secondary pf-btn-sm"
                    title={wh.isActive ? 'Désactiver' : 'Activer'}
                  >
                    <FontAwesomeIcon icon={faPowerOff} />
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    style={{
                      background: '#FEE2E2',
                      border: 'none',
                      color: '#DC2626',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title="Supprimer"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              {/* Secret and status */}
              <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8125rem', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FontAwesomeIcon icon={faShieldHalved} style={{ color: '#2563EB' }} />
                  <span>Secret de signature :</span>
                  <span style={{ fontFamily: 'monospace', color: '#0F172A' }}>
                    {wh.secret ? `${wh.secret.substring(0, 16)}••••••••` : 'whsec_••••'}
                  </span>
                  {wh.secret && (
                    <button
                      onClick={() => copySecret(wh.secret, wh.id)}
                      style={{ background: 'transparent', border: 'none', color: copiedSecretId === wh.id ? '#16A34A' : '#64748B', cursor: 'pointer', padding: '0 4px' }}
                    >
                      <FontAwesomeIcon icon={copiedSecretId === wh.id ? faCheck : faCopy} />
                    </button>
                  )}
                </div>

                <div>
                  Dernier statut : <strong>{wh.lastDeliveryStatus || 'Aucune livraison'}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: AJOUTER UN WEBHOOK */}
      {isAddModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Configurer un endpoint webhook</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="pf-form-group">
                <label className="pf-label">URL de destination</label>
                <input
                  type="url"
                  className="pf-input"
                  placeholder="https://votre-site.com/api/webhooks/pichflow"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Description ou serveur</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder="Ex: Serveur Production Afrique"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Événements à écouter</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {WEBHOOK_EVENT_TYPES.map((evt) => {
                    const isChecked = selectedEvents.includes(evt.id);
                    return (
                      <label
                        key={evt.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          background: isChecked ? '#EFF6FF' : '#FFFFFF',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedEvents([...selectedEvents, evt.id]);
                            else setSelectedEvents(selectedEvents.filter((x) => x !== evt.id));
                          }}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{evt.label}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{evt.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                  <span>Enregistrer l'endpoint</span>
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
