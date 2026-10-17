import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEye, faTrash, faUser, faXmark, faRotate, faCheck, faPen } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { Application, Customer } from '../../types';

interface CustomersViewProps {
  appName?: string;
  activeApp?: Application;
  customers?: Customer[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  appName = 'Mon Application',
  activeApp,
  customers: initialCustomers,
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('BJ');

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.customers.getAll(activeApp?.id);
      setCustomers(data || []);
    } catch {
      showToast('Impossible de charger les clients.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Le nom et l’adresse email sont obligatoires.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiClient.customers.create({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country,
        applicationId: activeApp?.id,
      });
      setCustomers((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      showToast('Nouveau client ajouté avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l’ajout du client.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await apiClient.customers.update(selectedCustomer.id, {
        name: name.trim(),
        phone: phone.trim(),
        country,
      });

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? { ...c, name: name.trim(), phone: phone.trim(), country }
            : c
        )
      );
      setIsEditModalOpen(false);
      setSelectedCustomer(null);
      showToast('Informations du client mises à jour.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la mise à jour.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir archiver ou supprimer ce client ?')) {
      return;
    }
    try {
      await apiClient.customers.delete(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      showToast('Client supprimé avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer ce client.', 'error');
    }
  };

  const openEditModal = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(c);
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone || '');
    setCountry(c.country || 'BJ');
    setIsEditModalOpen(true);
  };

  const filteredCustomers = customers.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Clients & Utilisateurs finaux</h1>
          <p className="pf-page-subtitle">
            Gérez le carnet d'adresses clients et l'historique de paiement de {appName}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadCustomers}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les clients"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={() => {
              setName('');
              setEmail('');
              setPhone('');
              setIsAddModalOpen(true);
            }}
            className="pf-btn-action-primary"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="pf-saspay-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="pf-search-filter-input"
          style={{ width: '100%', boxSizing: 'border-box' }}
          placeholder="Rechercher par nom, email ou numéro de téléphone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Empty State vs Real Table */}
      {filteredCustomers.length === 0 ? (
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
            <FontAwesomeIcon icon={faUser} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Aucun client pour le moment
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Vos clients apparaîtront ici automatiquement dès qu'ils auront effectué un premier paiement, ou vous pouvez les ajouter manuellement dès maintenant.
          </p>
          <button
            onClick={() => {
              setName('');
              setEmail('');
              setPhone('');
              setIsAddModalOpen(true);
            }}
            className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Ajouter votre premier client</span>
          </button>
        </div>
      ) : (
        <div className="pf-saspay-table-wrapper">
          <div className="pf-table-scroll">
            <table className="pf-saspay-table">
              <thead>
                <tr>
                  <th>CLIENT</th>
                  <th>EMAIL</th>
                  <th>TÉLÉPHONE</th>
                  <th>PAYS</th>
                  <th>COMMANDES</th>
                  <th>VOLUME TOTAL</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            background: '#EFF6FF',
                            color: '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }}>
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: '#475569', fontSize: '0.8125rem' }}>{c.email}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#64748B', fontSize: '0.8125rem' }}>
                        {c.phone || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="pf-pill-currency">{c.country || 'BJ'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }}>
                        {c.paymentCount || 0}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0F172A', fontSize: '0.875rem' }}>
                        {(c.totalSpent || 0).toLocaleString('fr-FR')} {c.currency || 'XOF'}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          title="Consulter la fiche client"
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
                          onClick={(e) => openEditModal(c, e)}
                          title="Modifier le client"
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
                          onClick={(e) => handleDeleteCustomer(c.id, e)}
                          title="Supprimer le client"
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

      {/* MODAL 1: FICHE DETAILS CLIENT */}
      {selectedCustomer && !isEditModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Fiche client : {selectedCustomer.name}</h3>
              <button onClick={() => setSelectedCustomer(null)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', lineHeight: '1.7', fontSize: '0.875rem' }}>
              <div><strong>Nom complet :</strong> {selectedCustomer.name}</div>
              <div><strong>Adresse email :</strong> {selectedCustomer.email}</div>
              <div><strong>Téléphone :</strong> {selectedCustomer.phone || 'Non renseigné'}</div>
              <div><strong>Pays :</strong> {selectedCustomer.country || 'Bénin'}</div>
              <div><strong>Nombre de transactions :</strong> {selectedCustomer.paymentCount || 0}</div>
              <div><strong>Volume total dépensé :</strong> {(selectedCustomer.totalSpent || 0).toLocaleString('fr-FR')} {selectedCustomer.currency || 'XOF'}</div>
              {selectedCustomer.lastTransaction && (
                <>
                  <div><strong>Dernière référence :</strong> {selectedCustomer.lastTransaction.reference}</div>
                  <div><strong>Dernier paiement :</strong> {selectedCustomer.lastTransaction.amount.toLocaleString('fr-FR')} {selectedCustomer.lastTransaction.currency} — {selectedCustomer.lastTransaction.status}</div>
                  {selectedCustomer.lastTransaction.paymentLinkTitle && (
                    <div><strong>Lien associé :</strong> {selectedCustomer.lastTransaction.paymentLinkTitle}</div>
                  )}
                </>
              )}
              <div>
                <strong>Dernière activité :</strong>{' '}
                {new Date(selectedCustomer.lastTransactionAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            <button
              onClick={() => setSelectedCustomer(null)}
              className="pf-btn pf-btn-secondary pf-btn-md"
              style={{ width: '100%' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: AJOUTER UN CLIENT */}
      {isAddModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Ajouter un nouveau client</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div className="pf-form-group">
                <label className="pf-label">Nom complet du client</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder="Ex: Alexandre Dossou"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Adresse email</label>
                <input
                  type="email"
                  className="pf-input"
                  placeholder="Ex: alexandre@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Numéro de téléphone</label>
                <input
                  type="tel"
                  className="pf-input"
                  placeholder="Ex: +229 97 00 12 34"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Pays</label>
                <select
                  className="pf-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="BJ">Bénin (+229)</option>
                  <option value="CI">Côte d'Ivoire (+225)</option>
                  <option value="SN">Sénégal (+221)</option>
                  <option value="TG">Togo (+228)</option>
                  <option value="BF">Burkina Faso (+226)</option>
                  <option value="CM">Cameroun (+237)</option>
                </select>
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
                  disabled={isSubmitting}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isSubmitting ? 'Enregistrement...' : 'Créer le client'}</span>
                  <FontAwesomeIcon icon={faCheck} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MODIFIER LE CLIENT */}
      {isEditModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Modifier le client</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer}>
              <div className="pf-form-group">
                <label className="pf-label">Nom complet</label>
                <input
                  type="text"
                  className="pf-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Adresse email (non modifiable)</label>
                <input
                  type="email"
                  className="pf-input"
                  value={email}
                  disabled
                  style={{ background: '#F1F5F9', color: '#64748B' }}
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Numéro de téléphone</label>
                <input
                  type="tel"
                  className="pf-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Pays</label>
                <select
                  className="pf-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="BJ">Bénin (+229)</option>
                  <option value="CI">Côte d'Ivoire (+225)</option>
                  <option value="SN">Sénégal (+221)</option>
                  <option value="TG">Togo (+228)</option>
                  <option value="BF">Burkina Faso (+226)</option>
                  <option value="CM">Cameroun (+237)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isSubmitting ? 'Mise à jour...' : 'Sauvegarder'}</span>
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
