import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faBuildingColumns,
  faMobileScreen,
  faCheck,
  faXmark,
  faTrash,
  faStar,
  faShieldHalved,
  faArrowRight,
  faCircleCheck,
  faRotate,
  faMoneyBillTransfer,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { apiClient } from '../../lib/api';
import { Withdrawal, PayoutMethod } from '../../types';

interface WithdrawalsViewProps {
  appName?: string;
  withdrawals?: Withdrawal[];
  onOpenWithdrawalModal?: () => void;
}

export const WithdrawalsView: React.FC<WithdrawalsViewProps> = ({ appName = 'Mon Application' }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'retraits' | 'methodes'>('retraits');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Real data from database
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);

  // Modals
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New withdrawal form
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5000');
  const [withdrawNote, setWithdrawNote] = useState<string>('');

  // New payout method form
  const [newMethodType, setNewMethodType] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState('BJ');
  const [operatorOrBank, setOperatorOrBank] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhoneOrIban, setRecipientPhoneOrIban] = useState('');
  // Bank-specific fields
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [swiftBic, setSwiftBic] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [currency, setCurrency] = useState('XOF');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wList, mList] = await Promise.all([
        apiClient.withdrawals.getAll(),
        apiClient.payoutMethods.getAll(),
      ]);
      setWithdrawals(wList);
      setPayoutMethods(mList);
      if (mList.length > 0 && !selectedMethodId) {
        const def = mList.find((m) => m.isDefault) || mList[0];
        setSelectedMethodId(def.id);
      }
    } catch {
      showToast('Impossible de charger les retraits et méthodes.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedMethodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(withdrawAmount);
    if (!parsedAmount || parsedAmount < 500) {
      showToast('Le montant minimum de retrait est de 500 XOF.', 'error');
      return;
    }

    const chosenMethod = payoutMethods.find((m) => m.id === selectedMethodId);

    setIsSubmitting(true);
    try {
      const created = await apiClient.withdrawals.create({
        amount: parsedAmount,
        currency: chosenMethod ? chosenMethod.currency : 'XOF',
        methodType: chosenMethod ? chosenMethod.type : 'mobile_money',
        recipientName: chosenMethod ? chosenMethod.recipientName : '',
        recipientPhoneOrIban: chosenMethod ? (chosenMethod.accountNumber || chosenMethod.recipientPhoneOrIban) : '',
        operatorOrBank: chosenMethod ? chosenMethod.operatorOrBank : 'Mobile Money',
        country: chosenMethod ? chosenMethod.country : 'BJ',
      });

      setWithdrawals((prev) => [created, ...prev]);
      setWithdrawalModalOpen(false);
      showToast(`Demande de retrait de ${parsedAmount.toLocaleString('fr-FR')} XOF enregistrée avec succès.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Solde insuffisant ou erreur lors du traitement du retrait.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMethodType === 'mobile_money' && (!operatorOrBank || !recipientPhoneOrIban)) {
      showToast('Opérateur et numéro de téléphone requis.', 'error');
      return;
    }
    if (newMethodType === 'bank_transfer' && (!operatorOrBank || !recipientName || (!accountNumber && !recipientPhoneOrIban))) {
      showToast('Banque, titulaire et numéro de compte requis.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiClient.payoutMethods.create({
        type: newMethodType,
        label: label.trim() || (newMethodType === 'mobile_money' ? `${operatorOrBank} ${recipientPhoneOrIban}` : `${operatorOrBank} - ${recipientName}`),
        operatorOrBank: operatorOrBank.trim(),
        recipientName: recipientName.trim(),
        recipientPhoneOrIban: recipientPhoneOrIban.trim(),
        accountNumber: accountNumber.trim(),
        iban: iban.trim(),
        swiftBic: swiftBic.trim(),
        bankCode: bankCode.trim(),
        branchCode: branchCode.trim(),
        country,
        currency,
      });

      setPayoutMethods((prev) => [created, ...prev]);
      if (!selectedMethodId) setSelectedMethodId(created.id);
      setMethodModalOpen(false);
      // Reset form
      setLabel('');
      setRecipientPhoneOrIban('');
      setAccountNumber('');
      setIban('');
      setSwiftBic('');
      setBankCode('');
      setBranchCode('');
      showToast('Nouvelle méthode de retrait enregistrée et vérifiée.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l’enregistrement de la méthode.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMethod = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette méthode de retrait ?')) {
      return;
    }
    try {
      await apiClient.payoutMethods.delete(id);
      setPayoutMethods((prev) => prev.filter((m) => m.id !== id));
      if (selectedMethodId === id) setSelectedMethodId('');
      showToast('Méthode de retrait supprimée.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer cette méthode.', 'error');
    }
  };

  const handleSetDefaultMethod = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.payoutMethods.setDefault(id);
      setPayoutMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isDefault: m.id === id,
        }))
      );
      setSelectedMethodId(id);
      showToast('Méthode définie par défaut.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Impossible de modifier la méthode par défaut.', 'error');
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      w.id.toLowerCase().includes(term) ||
      (w.reference && w.reference.toLowerCase().includes(term)) ||
      (w.recipientName && w.recipientName.toLowerCase().includes(term)) ||
      (w.recipientPhoneOrIban && w.recipientPhoneOrIban.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Retraits & Reversements</h1>
          <p className="pf-page-subtitle">
            Pilotez les versements et reversements de {appName} vers vos comptes Mobile Money ou bancaires.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadData}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les données"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs + Primary Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTab('retraits')}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'retraits' ? '#2563EB' : 'transparent',
              color: activeTab === 'retraits' ? '#FFFFFF' : '#475569',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Historique des retraits ({withdrawals.length})
          </button>
          <button
            onClick={() => setActiveTab('methodes')}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'methodes' ? '#2563EB' : 'transparent',
              color: activeTab === 'methodes' ? '#FFFFFF' : '#475569',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Méthodes enregistrées ({payoutMethods.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'methodes' ? (
            <button
              onClick={() => setMethodModalOpen(true)}
              className="pf-btn-action-primary"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Ajouter une méthode</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (payoutMethods.length === 0) {
                  showToast('Veuillez d’abord ajouter une méthode de versement (Mobile Money ou Banque).', 'info');
                  setActiveTab('methodes');
                  setMethodModalOpen(true);
                } else {
                  setWithdrawalModalOpen(true);
                }
              }}
              className="pf-btn-action-primary"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Demander un retrait</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: RETRAITS */}
      {activeTab === 'retraits' && (
        <>
          <div className="pf-saspay-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
            <input
              type="text"
              className="pf-search-filter-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="Rechercher par référence, bénéficiaire ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredWithdrawals.length === 0 ? (
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
                <FontAwesomeIcon icon={faMoneyBillTransfer} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                Aucun retrait pour le moment
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
                Vos demandes de versement vers vos comptes Mobile Money ou bancaires apparaîtront ici dès que vous aurez effectué un premier retrait depuis vos soldes.
              </p>
              <button
                onClick={() => {
                  if (payoutMethods.length === 0) {
                    setActiveTab('methodes');
                    setMethodModalOpen(true);
                  } else {
                    setWithdrawalModalOpen(true);
                  }
                }}
                className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Effectuer un retrait</span>
              </button>
            </div>
          ) : (
            <div className="pf-saspay-table-wrapper">
              <div className="pf-table-scroll">
                <table className="pf-saspay-table">
                  <thead>
                    <tr>
                      <th>RÉFÉRENCE</th>
                      <th>BÉNÉFICIAIRE & MÉTHODE</th>
                      <th>DEMANDÉ LE</th>
                      <th>STATUT</th>
                      <th style={{ textAlign: 'right' }}>MONTANT NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWithdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                            {w.reference || w.id}
                          </span>
                        </td>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.875rem' }}>
                              {w.recipientName || w.operatorOrBank}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              {w.operatorOrBank} · {w.recipientPhoneOrIban}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>
                            {new Date(w.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`pf-pill-status ${w.status === 'completed' ? 'reussi' : w.status === 'failed' ? 'echoue' : 'en_attente'}`}>
                            {w.status === 'completed' ? 'Réussi' : w.status === 'failed' ? 'Échoué' : 'En traitement'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>
                            {(w.netAmount || w.amount).toLocaleString('fr-FR')} {w.currency || 'XOF'}
                          </strong>
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

      {/* TAB 2: METHODES DE RETRAIT */}
      {activeTab === 'methodes' && (
        <div className="pf-saspay-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                Méthodes de versement vérifiées
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                Comptes Mobile Money ou bancaires autorisés pour recevoir vos reversements.
              </div>
            </div>
            <button
              onClick={() => setMethodModalOpen(true)}
              className="pf-btn pf-btn-secondary pf-btn-sm"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Nouvelle méthode</span>
            </button>
          </div>

          {payoutMethods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <div
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '1.25rem',
                }}
              >
                <FontAwesomeIcon icon={faBuildingColumns} />
              </div>
              <h4 style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
                Aucune méthode de retrait enregistrée
              </h4>
              <p style={{ color: '#64748B', fontSize: '0.8125rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                Ajoutez un compte Mobile Money (MTN, Moov, Orange, Wave) ou un compte bancaire pour débloquer les virements.
              </p>
              <button
                onClick={() => setMethodModalOpen(true)}
                className="pf-btn pf-btn-primary pf-btn-sm"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Ajouter un compte de versement</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {payoutMethods.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '1.15rem',
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: m.isDefault ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '10px',
                          background: m.type === 'mobile_money' ? '#EFF6FF' : '#F0FDF4',
                          color: m.type === 'mobile_money' ? '#2563EB' : '#16A34A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.125rem',
                        }}
                      >
                        <FontAwesomeIcon icon={m.type === 'mobile_money' ? faMobileScreen : faBuildingColumns} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>
                          {m.label || m.operatorOrBank}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {m.type === 'mobile_money' ? 'Mobile Money' : 'Compte Bancaire'} · {m.country}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {m.isDefault ? (
                        <span className="pf-pill-status actif">
                          <FontAwesomeIcon icon={faStar} style={{ marginRight: '4px' }} />
                          Par défaut
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleSetDefaultMethod(m.id, e)}
                          title="Définir comme méthode principale"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: '#64748B',
                            cursor: 'pointer',
                          }}
                        >
                          Définir par défaut
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteMethod(m.id, e)}
                        title="Supprimer la méthode"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          padding: '0.35rem',
                          borderRadius: '6px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: '1.6', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px' }}>
                    <div><strong>Opérateur / Banque :</strong> {m.operatorOrBank}</div>
                    {m.recipientName && <div><strong>Titulaire :</strong> {m.recipientName}</div>}
                    <div>
                      <strong>{m.type === 'mobile_money' ? 'Numéro de téléphone :' : 'Numéro de compte :'}</strong>{' '}
                      <span style={{ fontFamily: 'monospace' }}>{m.accountNumber || m.recipientPhoneOrIban}</span>
                    </div>
                    {m.iban && <div><strong>IBAN :</strong> <span style={{ fontFamily: 'monospace' }}>{m.iban}</span></div>}
                    {m.swiftBic && <div><strong>SWIFT / BIC :</strong> <span style={{ fontFamily: 'monospace' }}>{m.swiftBic}</span></div>}
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#16A34A' }}>
                    <span>
                      <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '4px' }} />
                      Vérifié & certifié
                    </span>
                    <span style={{ color: '#94A3B8' }}>{m.currency}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: DEMANDER UN RETRAIT */}
      {withdrawalModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setWithdrawalModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Demander un reversement</h3>
              <button onClick={() => setWithdrawalModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ padding: '0.75rem', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '0.75rem', color: '#1E40AF', marginBottom: '1.25rem' }}>
              <strong>Environnement Sandbox :</strong> simulation d'ordre de virement bancaire ou mobile money sécurisé sans impact sur les réseaux bancaires réels.
            </div>

            <form onSubmit={handleWithdrawSubmit}>
              <div className="pf-form-group">
                <label className="pf-label">Méthode de réception</label>
                {payoutMethods.length === 0 ? (
                  <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.8125rem' }}>
                    Aucune méthode configurée. Veuillez d’abord enregistrer une méthode.
                  </div>
                ) : (
                  <select
                    className="pf-select"
                    value={selectedMethodId}
                    onChange={(e) => setSelectedMethodId(e.target.value)}
                    required
                  >
                    {payoutMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.operatorOrBank} - {m.accountNumber || m.recipientPhoneOrIban}) {m.isDefault ? '★ Défaut' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Montant à reverser (XOF)</label>
                <input
                  type="number"
                  className="pf-input"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="500"
                  step="500"
                  placeholder="Ex: 25000"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem', display: 'block' }}>
                  Frais de transaction : 0 XOF (pris en charge par la plateforme en mode test).
                </span>
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Motif ou référence interne (facultatif)</label>
                <input
                  type="text"
                  className="pf-input"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="Ex: Virement hebdomadaire trésorerie"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setWithdrawalModalOpen(false)}
                  className="pf-btn pf-btn-secondary pf-btn-md"
                  style={{ flex: 1 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || payoutMethods.length === 0}
                  className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                  style={{ flex: 1 }}
                >
                  <span>{isSubmitting ? 'Traitement...' : 'Valider le retrait'}</span>
                  <FontAwesomeIcon icon={faCheck} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJOUTER UNE METHODE DE RETRAIT (Dynamic Category A vs B) */}
      {methodModalOpen && (
        <div className="pf-modal-overlay" onClick={() => setMethodModalOpen(false)}>
          <div className="pf-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="pf-modal-header">
              <h3 className="pf-card-title">Ajouter une méthode de retrait</h3>
              <button onClick={() => setMethodModalOpen(false)} className="pf-modal-close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {/* Type selector: Mobile Money vs Bank */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                onClick={() => setNewMethodType('mobile_money')}
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: newMethodType === 'mobile_money' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: newMethodType === 'mobile_money' ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <FontAwesomeIcon icon={faMobileScreen} style={{ color: '#2563EB', fontSize: '1.25rem', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>Mobile Money</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>MTN, Moov, Orange, Wave</div>
              </div>

              <div
                onClick={() => setNewMethodType('bank_transfer')}
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: newMethodType === 'bank_transfer' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: newMethodType === 'bank_transfer' ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <FontAwesomeIcon icon={faBuildingColumns} style={{ color: '#2563EB', fontSize: '1.25rem', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>Virement Bancaire</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>BOA, Ecobank, UBA, etc.</div>
              </div>
            </div>

            <form onSubmit={handleCreateMethodSubmit}>
              {/* COMMON: Label personnalisé & Pays */}
              <div className="pf-form-group">
                <label className="pf-label">Libellé personnalisé</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder={newMethodType === 'mobile_money' ? 'Ex: Mon MTN Principal Bénin' : 'Ex: Compte Trésorerie BOA'}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Pays concerné</label>
                <select
                  className="pf-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="BJ">Bénin (+229) · XOF</option>
                  <option value="CI">Côte d'Ivoire (+225) · XOF</option>
                  <option value="SN">Sénégal (+221) · XOF</option>
                  <option value="TG">Togo (+228) · XOF</option>
                  <option value="BF">Burkina Faso (+226) · XOF</option>
                  <option value="CM">Cameroun (+237) · XAF</option>
                </select>
              </div>

              {/* CATEGORY A: MOBILE MONEY EXCLUSIVE FIELDS */}
              {newMethodType === 'mobile_money' && (
                <>
                  <div className="pf-form-group">
                    <label className="pf-label">Réseau / Opérateur Mobile Money</label>
                    <select
                      className="pf-select"
                      value={operatorOrBank}
                      onChange={(e) => setOperatorOrBank(e.target.value)}
                      required
                    >
                      <option value="">-- Sélectionnez un opérateur --</option>
                      <option value="MTN Mobile Money">MTN Mobile Money</option>
                      <option value="Moov Money">Moov Money (Flooz)</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="Wave">Wave Mobile Money</option>
                      <option value="Free Money">Free Money Sénégal</option>
                    </select>
                  </div>

                  <div className="pf-form-group">
                    <label className="pf-label">Numéro de téléphone bénéficiaire</label>
                    <input
                      type="tel"
                      className="pf-input"
                      placeholder="Ex: +229 97 00 12 34"
                      value={recipientPhoneOrIban}
                      onChange={(e) => setRecipientPhoneOrIban(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pf-form-group">
                    <label className="pf-label">Nom complet du titulaire de la ligne</label>
                    <input
                      type="text"
                      className="pf-input"
                      placeholder="Ex: Alexandre Dossou"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {/* CATEGORY B: VIREMENT BANCAIRE EXCLUSIVE FIELDS */}
              {newMethodType === 'bank_transfer' && (
                <>
                  <div className="pf-form-group">
                    <label className="pf-label">Nom de la banque</label>
                    <select
                      className="pf-select"
                      value={operatorOrBank}
                      onChange={(e) => setOperatorOrBank(e.target.value)}
                      required
                    >
                      <option value="">-- Sélectionnez votre banque --</option>
                      <option value="Bank of Africa (BOA)">Bank of Africa (BOA)</option>
                      <option value="Ecobank">Ecobank</option>
                      <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                      <option value="Coris Bank International">Coris Bank International</option>
                      <option value="Société Générale">Société Générale</option>
                      <option value="BGFIBank">BGFIBank</option>
                      <option value="Banque Atlantique">Banque Atlantique</option>
                      <option value="Orabank">Orabank</option>
                      <option value="Autre banque">Autre banque commerciale</option>
                    </select>
                  </div>

                  <div className="pf-form-group">
                    <label className="pf-label">Nom du titulaire du compte (exact)</label>
                    <input
                      type="text"
                      className="pf-input"
                      placeholder="Ex: SARL PICHFLOW AFRIQUE"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pf-form-group">
                    <label className="pf-label">Numéro de compte</label>
                    <input
                      type="text"
                      className="pf-input"
                      placeholder="Ex: 012345678901"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pf-form-row-2col">
                    <div className="pf-form-group">
                      <label className="pf-label">Code Banque (facultatif)</label>
                      <input
                        type="text"
                        className="pf-input"
                        placeholder="Ex: BJ061"
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                      />
                    </div>
                    <div className="pf-form-group">
                      <label className="pf-label">Code Guichet (facultatif)</label>
                      <input
                        type="text"
                        className="pf-input"
                        placeholder="Ex: 01001"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pf-form-row-2col">
                    <div className="pf-form-group">
                      <label className="pf-label">IBAN (facultatif)</label>
                      <input
                        type="text"
                        className="pf-input"
                        placeholder="Ex: BJ66 BJ06 1010..."
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                      />
                    </div>
                    <div className="pf-form-group">
                      <label className="pf-label">SWIFT / BIC (facultatif)</label>
                      <input
                        type="text"
                        className="pf-input"
                        placeholder="Ex: AFRIBJBJ"
                        value={swiftBic}
                        onChange={(e) => setSwiftBic(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setMethodModalOpen(false)}
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
                  <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer la méthode'}</span>
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
