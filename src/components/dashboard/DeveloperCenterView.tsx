import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faKey,
  faShieldHalved,
  faTrash,
  faCopy,
  faCheck,
  faRotate,
  faXmark,
  faPlus,
  faCode,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { ApiKey, Application } from '../../types';

export const DeveloperCenterView: React.FC<{ appName?: string; activeApp?: Application }> = ({
  appName = 'Mon Application',
  activeApp,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');
  const [envFilter, setEnvFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [keysList, setKeysList] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New key form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyScope, setKeyScope] = useState<'both' | 'payin' | 'payout'>('both');
  const [isGenerating, setIsGenerating] = useState(false);

  // Created secret keys reveal modal (Shown ONLY once on creation!)
  const [createdKeysModal, setCreatedKeysModal] = useState<{ sandbox: ApiKey; live: ApiKey } | null>(null);
  const [copiedTest, setCopiedTest] = useState(false);
  const [copiedLive, setCopiedLive] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const keys = await apiClient.developer.getKeys(activeApp?.id);
      setKeysList(keys || []);
    } catch {
      showToast('Impossible de charger les clés API.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await apiClient.developer.generateKey({
        name: keyName.trim() || 'Intégration API',
        scope: keyScope,
        applicationId: activeApp?.id,
      });

      if (res.keys) {
        setCreatedKeysModal(res.keys);
        setKeysList((prev) => [res.keys!.live, res.keys!.sandbox, ...prev]);
      } else if (res.apiKey) {
        setKeysList((prev) => [res.apiKey, ...prev]);
      }

      setIsModalOpen(false);
      setKeyName('');
      showToast('Paire de clés Sandbox et Live générée avec succès !', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la génération des clés.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir révoquer cette clé API ? Toutes les requêtes utilisant cette clé seront rejetées immédiatement.')) {
      return;
    }
    try {
      await apiClient.developer.revokeKey(id, activeApp?.id || '');
      setKeysList((prev) => prev.filter((k) => k.id !== id));
      showToast('Clé secrète révoquée.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Impossible de révoquer cette clé.', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Clé secrète copiée dans le presse-papier !', 'info');
  };

  const filteredKeys = keysList.filter((k) => {
    if (envFilter !== 'all' && k.environment !== envFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return k.name.toLowerCase().includes(term) || k.prefix.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Développeurs & Clés API</h1>
          <p className="pf-page-subtitle">
            Générez et révoquez vos clés secrètes d'authentification pour intégrer {appName} à vos applications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadKeys}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les clés"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Générer une clé API</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('keys')}
          style={{
            padding: '0.5rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'keys' ? '#2563EB' : '#F1F5F9',
            color: activeTab === 'keys' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          Clés d'API ({keysList.length})
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          style={{
            padding: '0.5rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'docs' ? '#2563EB' : '#F1F5F9',
            color: activeTab === 'docs' ? '#FFFFFF' : '#475569',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          <FontAwesomeIcon icon={faCode} style={{ marginRight: '6px' }} />
          Documentation d'intégration
        </button>
      </div>

      {activeTab === 'keys' && (
        <>
          {/* Filters Bar */}
          <div className="pf-saspay-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input
              type="text"
              className="pf-search-filter-input"
              style={{ minWidth: '260px', flex: 1, boxSizing: 'border-box' }}
              placeholder="Rechercher par libellé ou préfixe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['all', 'sandbox', 'live'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setEnvFilter(env)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    background: envFilter === env ? '#0F172A' : '#FFFFFF',
                    color: envFilter === env ? '#FFFFFF' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {env === 'all' ? 'Toutes' : env === 'sandbox' ? 'Sandbox (Test)' : 'Live (Production)'}
                </button>
              ))}
            </div>
          </div>

          {/* Real Keys List vs Empty State */}
          {filteredKeys.length === 0 ? (
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
                <FontAwesomeIcon icon={faKey} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                Aucune clé API pour le moment
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
                Générez une première clé secrète Sandbox pour tester vos paiements ou Live pour connecter votre backend en production.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Générer une première clé</span>
              </button>
            </div>
          ) : (
            <div className="pf-saspay-table-wrapper">
              <div className="pf-table-scroll">
                <table className="pf-saspay-table">
                  <thead>
                    <tr>
                      <th>LIBELLÉ</th>
                      <th>ENVIRONNEMENT</th>
                      <th>CLÉ SECRÈTE MASQUÉE</th>
                      <th>PORTÉE</th>
                      <th>DATE DE CRÉATION</th>
                      <th>STATUT</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.875rem' }}>
                            {k.name}
                          </div>
                        </td>
                        <td>
                          <span className={`pf-pill-currency ${k.environment === 'live' ? 'live' : 'sandbox'}`}>
                            {k.environment === 'live' ? 'Live' : 'Sandbox'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.8125rem' }}>
                            {k.prefix}••••••••••••
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8125rem', color: '#334155' }}>
                            {k.scope === 'both' ? 'Payin & Payout' : k.scope}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                            {new Date(k.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`pf-pill-status ${k.isActive ? 'actif' : 'inactif'}`}>
                            {k.isActive ? 'Active' : 'Révoquée'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={(e) => handleRevoke(k.id, e)}
                            style={{
                              background: '#FEE2E2',
                              border: 'none',
                              color: '#DC2626',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            title="Révoquer cette clé"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: DOCUMENTATION API */}
      {activeTab === 'docs' && (
        <div className="pf-saspay-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.75rem' }}>
            Documentation d'intégration API
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Toutes les requêtes API vers PichFlow doivent inclure votre clé secrète dans l'en-tête HTTP <code>Authorization: Bearer sk_...</code>.
          </p>

          <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '1rem', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
            <div style={{ color: '#94A3B8', marginBottom: '0.5rem' }}># 1. Exemple : Initialiser un paiement client (PayDunya Sandbox)</div>
            <div>curl -X POST https://api.pichflow.com/api/checkout/initiate \</div>
            <div style={{ paddingLeft: '1.5rem' }}>-H "Authorization: Bearer sk_sandbox_..." \</div>
            <div style={{ paddingLeft: '1.5rem' }}>-H "Content-Type: application/json" \</div>
            <div style={{ paddingLeft: '1.5rem' }}>-d '&#123; "amount": 15000, "currency": "XOF", "description": "Commande #482", "customerEmail": "client@example.com" &#125;'</div>
          </div>

          <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '1rem', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
            <div style={{ color: '#94A3B8', marginBottom: '0.5rem' }}># 2. Exemple : Vérifier le statut d'une transaction</div>
            <div>curl https://api.pichflow.com/api/checkout/status/TX-PF-10492 \</div>
            <div style={{ paddingLeft: '1.5rem' }}>-H "Authorization: Bearer sk_sandbox_..."</div>
          </div>
        </div>
      )}

      {/* MODAL 1: GENERER UNE CLE API */}
      {isModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Générer une clé secrète API</h3>
              <button onClick={() => setIsModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleGenerate}>
              <div className="pf-form-group">
                <label className="pf-label">Nom de l'intégration / Clé</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder="Ex: Application Mobile, Site Web, ERP"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', color: '#1E40AF', fontSize: '0.8125rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                <strong>Génération automatique :</strong> PichFlow crée simultanément deux clés cryptographiquement distinctes :
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                  <li>Une clé <strong>Sandbox</strong> (<code>sk_test_...</code>) pour vos tests</li>
                  <li>Une clé <strong>Live</strong> (<code>sk_live_...</code>) pour vos encaissements réels</li>
                </ul>
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Portée des droits (Scope)</label>
                <select
                  className="pf-select"
                  value={keyScope}
                  onChange={(e) => setKeyScope(e.target.value as any)}
                >
                  <option value="both">Encaissement et Décaissement (Payin & Payout)</option>
                  <option value="payin">Encaissement uniquement (Payin)</option>
                  <option value="payout">Décaissement uniquement (Payout)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isGenerating ? 'Génération...' : 'Créer mes clés API'}</span>
                  <FontAwesomeIcon icon={faCheck} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AFFICHER LA PAIRE DE CLES SECRETES (Unique fois !) */}
      {createdKeysModal && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-content" style={{ maxWidth: '560px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title" style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FontAwesomeIcon icon={faKey} />
                <span>Paire de clés API générée</span>
              </h3>
            </div>

            <div style={{ padding: '0.85rem 1rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', color: '#92400E', fontSize: '0.8125rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              <strong>Important :</strong> Copiez ces clés secrètes dès maintenant. Pour des raisons strictes de sécurité, <strong>elles ne seront plus jamais affichées dans leur intégralité</strong>.
            </div>

            {/* Sandbox Key */}
            <div className="pf-form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="pf-label" style={{ margin: 0, fontWeight: 700, color: '#2563EB' }}>
                  Clé Sandbox / Test (sk_test_...)
                </label>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: '#EFF6FF', color: '#2563EB', borderRadius: '4px', fontWeight: 700 }}>
                  TEST UNIQUEMENT
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={createdKeysModal.sandbox.secretKey}
                  className="pf-input"
                  style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', background: '#F8FAFC', fontSize: '0.8125rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKeysModal.sandbox.secretKey || '');
                    setCopiedTest(true);
                    showToast('Clé Sandbox copiée !', 'info');
                    setTimeout(() => setCopiedTest(false), 2200);
                  }}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ minWidth: '95px' }}
                >
                  <FontAwesomeIcon icon={copiedTest ? faCheck : faCopy} />
                  <span>{copiedTest ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Live Key */}
            <div className="pf-form-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="pf-label" style={{ margin: 0, fontWeight: 700, color: '#059669' }}>
                  Clé Live / Production (sk_live_...)
                </label>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: '#ECFDF5', color: '#059669', borderRadius: '4px', fontWeight: 700 }}>
                  PRODUCTION RÉELLE
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={createdKeysModal.live.secretKey}
                  className="pf-input"
                  style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', background: '#F8FAFC', fontSize: '0.8125rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKeysModal.live.secretKey || '');
                    setCopiedLive(true);
                    showToast('Clé Live copiée !', 'success');
                    setTimeout(() => setCopiedLive(false), 2200);
                  }}
                  className="pf-btn pf-btn-primary pf-btn-md"
                  style={{ minWidth: '95px' }}
                >
                  <FontAwesomeIcon icon={copiedLive ? faCheck : faCopy} />
                  <span>{copiedLive ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setCreatedKeysModal(null)}
                className="pf-btn pf-btn-secondary pf-btn-md"
                style={{ width: '100%', fontWeight: 700 }}
              >
                J'ai sauvegardé mes deux clés en lieu sûr
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
