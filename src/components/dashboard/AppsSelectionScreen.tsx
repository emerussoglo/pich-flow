import React, { useState } from 'react';
import { Application } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faEllipsisVertical,
  faEye,
  faPen,
  faShieldHalved,
  faKey,
  faChartLine,
  faTrash,
  faRocket,
  faBuilding,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { PichFlowLogo } from '../ui/PichFlowLogo';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';

interface AppsSelectionScreenProps {
  applications: Application[];
  user?: { full_name?: string; email?: string };
  onSelectApp: (app: Application) => void;
  onOpenNewAppModal: () => void;
  onNavigateToTab?: (tab: string, app: Application) => void;
  onRefreshApps?: () => void;
}

export const AppsSelectionScreen: React.FC<AppsSelectionScreenProps> = ({
  applications,
  user,
  onSelectApp,
  onOpenNewAppModal,
  onNavigateToTab,
  onRefreshApps,
}) => {
  const { showToast } = useToast();
  const [activeMenuAppId, setActiveMenuAppId] = useState<string | null>(null);
  const [detailModalApp, setDetailModalApp] = useState<Application | null>(null);
  const [editModalApp, setEditModalApp] = useState<Application | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const userName = user?.full_name || 'Cher Partenaire';

  const handleOpenEdit = (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuAppId(null);
    setEditModalApp(app);
    setEditName(app.name);
    setEditCategory(app.category);
    setEditWebsite(app.website || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalApp) return;

    try {
      await apiClient.apps.update(editModalApp.id, {
        name: editName,
        category: editCategory,
        website: editWebsite,
      });
      showToast('Application mise à jour avec succès.', 'success');
      setEditModalApp(null);
      if (onRefreshApps) onRefreshApps();
    } catch (err: any) {
      showToast(err.message || 'Erreur de mise à jour.', 'error');
    }
  };

  const handleDelete = async (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuAppId(null);

    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'application "${app.name}" ?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await apiClient.apps.delete(app.id);
      if (res.archived) {
        showToast(res.message, 'info');
      } else {
        showToast('Application supprimée avec succès.', 'success');
      }
      if (onRefreshApps) onRefreshApps();
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer cette application.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="pf-apps-screen-backdrop" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      {/* Brand Logo */}
      <div style={{ marginBottom: '2rem' }}>
        <PichFlowLogo size="lg" />
      </div>

      {/* Main Selection Card */}
      <div className="pf-apps-card-container" style={{ maxWidth: '840px', width: '100%', position: 'relative' }}>
        <h1 className="pf-apps-welcome-title">
          <span role="img" aria-label="Waving hand">👋</span> Bonjour {userName}, bienvenue sur PichFlow
        </h1>
        <p className="pf-apps-welcome-sub">
          {applications.length > 0
            ? 'Ton tableau de bord est prêt à être utilisé. Sélectionne ton application pour commencer.'
            : 'Bienvenue dans ton nouvel espace de paiement ! Crée ta première application pour générer tes clés API et commencer à encaisser.'}
        </p>

        {/* Empty State when user has 0 apps */}
        {applications.length === 0 ? (
          <div style={{
            background: '#F8FAFC',
            border: '2px dashed #CBD5E1',
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
            marginTop: '1.5rem',
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '1.75rem',
            }}>
              <FontAwesomeIcon icon={faRocket} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
              Aucune application enregistrée
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748B', maxWidth: '440px', margin: '0 auto 1.75rem', lineHeight: '1.5' }}>
              Pour démarrer vos encaissements et configurer vos passerelles de paiement Mobile Money & Cartes bancaires, commencez par créer votre première boutique ou application.
            </p>
            <button
              onClick={onOpenNewAppModal}
              className="pf-btn pf-btn-primary pf-btn-lg"
              style={{
                padding: '0.875rem 2rem',
                fontSize: '0.9375rem',
                fontWeight: 700,
                borderRadius: '0.625rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Créer ma première application</span>
            </button>
          </div>
        ) : (
          /* Applications row */
          <div className="pf-apps-cards-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app)}
                className="pf-app-choice-item"
                style={{ position: 'relative', cursor: 'pointer', padding: '1.5rem 1rem' }}
                title={`Accéder à ${app.name} (${app.category})`}
              >
                {/* 3-dots action menu button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuAppId(activeMenuAppId === app.id ? null : app.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '0.625rem',
                    right: '0.625rem',
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  <FontAwesomeIcon icon={faEllipsisVertical} />
                </div>

                {/* Dropdown Menu */}
                {activeMenuAppId === app.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '2.5rem',
                      right: '0.5rem',
                      background: '#FFFFFF',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
                      border: '1px solid #E2E8F0',
                      zIndex: 50,
                      width: '180px',
                      overflow: 'hidden',
                      textAlign: 'left',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuAppId(null);
                        setDetailModalApp(app);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        fontSize: '0.8125rem',
                        color: '#334155',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <FontAwesomeIcon icon={faEye} style={{ color: '#2563EB', width: '14px' }} />
                      <span>Détails</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenEdit(app, e)}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        fontSize: '0.8125rem',
                        color: '#334155',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <FontAwesomeIcon icon={faPen} style={{ color: '#64748B', width: '14px' }} />
                      <span>Modifier</span>
                    </button>

                    {onNavigateToTab && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuAppId(null);
                            onNavigateToTab('settings', app);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            fontSize: '0.8125rem',
                            color: '#334155',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <FontAwesomeIcon icon={faShieldHalved} style={{ color: '#059669', width: '14px' }} />
                          <span>Vérification KYC</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuAppId(null);
                            onNavigateToTab('developers', app);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            fontSize: '0.8125rem',
                            color: '#334155',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <FontAwesomeIcon icon={faKey} style={{ color: '#D97706', width: '14px' }} />
                          <span>Clés API</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuAppId(null);
                            onNavigateToTab('transactions', app);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            fontSize: '0.8125rem',
                            color: '#334155',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <FontAwesomeIcon icon={faChartLine} style={{ color: '#7C3AED', width: '14px' }} />
                          <span>Activité</span>
                        </button>
                      </>
                    )}

                    <div style={{ height: '1px', background: '#F1F5F9', margin: '0.25rem 0' }} />

                    <button
                      onClick={(e) => handleDelete(app, e)}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        fontSize: '0.8125rem',
                        color: '#DC2626',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} style={{ width: '14px' }} />
                      <span>Supprimer</span>
                    </button>
                  </div>
                )}

                <div className="pf-app-card-avatar">
                  {app.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#0F172A', display: 'block' }}>
                    {app.name}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {app.category}
                  </span>
                </div>
              </div>
            ))}

            {/* Create new application card */}
            <div
              onClick={onOpenNewAppModal}
              className="pf-app-choice-item create"
              title="Créer une nouvelle application et soumettre le KYC"
              style={{ padding: '1.5rem 1rem' }}
            >
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.5rem',
              }}>
                <FontAwesomeIcon icon={faPlus} style={{ fontSize: '1rem' }} />
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2563EB', textAlign: 'center' }}>
                Créer une application
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {detailModalApp && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '0.875rem',
            maxWidth: '480px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem' }}>
              Détails de l'application
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Nom :</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{detailModalApp.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Identifiant (ID) :</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{detailModalApp.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Catégorie :</span>
                <span>{detailModalApp.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Site Web :</span>
                <span>{detailModalApp.website || 'Non spécifié'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Statut :</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>Actif (Sandbox & Live)</span>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setDetailModalApp(null)}
                className="pf-btn pf-btn-secondary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalApp && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <form onSubmit={handleSaveEdit} style={{
            background: '#FFFFFF',
            borderRadius: '0.875rem',
            maxWidth: '480px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '1.25rem' }}>
              Modifier l'application
            </h3>
            <div className="pf-form-group" style={{ marginBottom: '1rem' }}>
              <label className="pf-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Nom de l'application
              </label>
              <input
                type="text"
                className="pf-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div className="pf-form-group" style={{ marginBottom: '1rem' }}>
              <label className="pf-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Catégorie
              </label>
              <select
                className="pf-select"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
              >
                <option value="E-commerce">E-commerce</option>
                <option value="SaaS & Logiciel">SaaS & Logiciel</option>
                <option value="Services">Services</option>
                <option value="Formation">Formation</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div className="pf-form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="pf-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                URL du site web
              </label>
              <input
                type="url"
                className="pf-input"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="https://monsite.com"
                style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setEditModalApp(null)}
                className="pf-btn pf-btn-secondary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="pf-btn pf-btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
