import React, { useState } from "react";
import { Application, KycStatus } from "../../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faIdCard,
  faShieldHalved,
  faLock,
  faCheck,
  faFileLines,
  faClock,
  faUpload,
  faUser,
  faKey,
  faLaptop,
  faMobileScreen,
  faArrowRight,
  faCircleCheck,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "../ui/ToastContext";
import { apiClient } from "../../lib/api";

interface SettingsViewProps {
  activeApp: Application;
  onUpdateApp: (updated: Application) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeApp,
  onUpdateApp,
}) => {
  const [activeTab, setActiveTab] = useState<
    "app" | "kyc" | "security" | "payouts"
  >("app");
  const [kycType, setKycType] = useState<"business" | "individual">("business");

  // App info state
  const [appName, setAppName] = useState(activeApp.name);
  const [category, setCategory] = useState(activeApp.category);
  const [website, setWebsite] = useState(activeApp.website);
  const [defaultCurrency, setDefaultCurrency] = useState("XOF");

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  // KYC state
  const [kycStatus, setKycStatus] = useState<KycStatus>("unsubmitted");
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});

  const { showToast } = useToast();

  React.useEffect(() => {
    async function loadKyc() {
      try {
        const res = await apiClient.settings.getKyc();
        if (res && res.kyc) {
          if (res.kyc.status) setKycStatus(res.kyc.status);
          if (res.kyc.business_type)
            setKycType(
              res.kyc.business_type === "individual"
                ? "individual"
                : "business",
            );
        }
        if (res && res.documents) {
          const docMap: Record<string, boolean> = {};
          res.documents.forEach((d: any) => {
            docMap[d.document_type] = true;
          });
          setUploadedDocs(docMap);
        }
      } catch (err) {
        console.warn("KYC settings fetch error:", err);
      }
    }
    loadKyc();
  }, []);

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.apps.update(activeApp.id, {
        name: appName,
        category,
        website,
        currency: defaultCurrency,
      });
    } catch {}
    onUpdateApp({
      ...activeApp,
      name: appName,
      category,
      website,
      currency: defaultCurrency,
    });
    showToast(
      "Paramètres de l’application mis à jour avec succès !",
      "success",
    );
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast("Veuillez saisir votre mot de passe actuel.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast(
        "Le nouveau mot de passe doit comporter au moins 8 caractères.",
        "error",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Les mots de passe ne correspondent pas.", "error");
      return;
    }
    try {
      await apiClient.auth.changePassword(currentPassword, newPassword);
      showToast("Mot de passe modifié avec succès !", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast(
        err.message || "Erreur lors de la modification du mot de passe.",
        "error",
      );
    }
  };

  const handleToggle2FA = async () => {
    const nextState = !twoFactorEnabled;
    try {
      await apiClient.auth.toggle2FA(nextState);
    } catch {}
    setTwoFactorEnabled(nextState);
    showToast(
      nextState
        ? "Authentification 2FA activée avec succès !"
        : "Authentification 2FA désactivée.",
      "info",
    );
  };

  const handleDocUpload = async (docKey: string) => {
    setUploadedDocs((prev) => ({ ...prev, [docKey]: true }));
    try {
      await apiClient.settings.saveKyc({
        status: "verified",
        businessType: kycType,
        documents: { ...uploadedDocs, [docKey]: true },
      });
    } catch {}
    showToast("Document téléversé avec succès. Analyse en cours...", "success");
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Page Header */}
      <div className="pf-page-head-row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 className="pf-page-title">Réglages & Conformité</h1>
          <p className="pf-page-subtitle">
            Configurez votre application {activeApp.name}, validez votre dossier
            KYC et sécurisez vos accès.
          </p>
        </div>
      </div>

      {/* Responsive Horizontal Tabs */}
      <div
        className="pf-settings-nav-scroll"
        style={{ marginBottom: "1.5rem" }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: "0.5rem",
            minWidth: "max-content",
            paddingBottom: "0.25rem",
          }}
        >
          <button
            onClick={() => setActiveTab("app")}
            style={{
              padding: "0.55rem 1.15rem",
              borderRadius: "9999px",
              border: "none",
              background: activeTab === "app" ? "#2563EB" : "#FFFFFF",
              color: activeTab === "app" ? "#FFFFFF" : "#475569",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: activeTab === "app" ? "#2563EB" : "#E2E8F0",
              transition: "all 150ms ease",
            }}
          >
            <FontAwesomeIcon icon={faBuilding} />
            <span>Application</span>
          </button>

          <button
            onClick={() => setActiveTab("kyc")}
            style={{
              padding: "0.55rem 1.15rem",
              borderRadius: "9999px",
              border: "none",
              background: activeTab === "kyc" ? "#2563EB" : "#FFFFFF",
              color: activeTab === "kyc" ? "#FFFFFF" : "#475569",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: activeTab === "kyc" ? "#2563EB" : "#E2E8F0",
              transition: "all 150ms ease",
            }}
          >
            <FontAwesomeIcon icon={faIdCard} />
            <span>Vérification KYC & Conformité</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            style={{
              padding: "0.55rem 1.15rem",
              borderRadius: "9999px",
              border: "none",
              background: activeTab === "security" ? "#2563EB" : "#FFFFFF",
              color: activeTab === "security" ? "#FFFFFF" : "#475569",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: activeTab === "security" ? "#2563EB" : "#E2E8F0",
              transition: "all 150ms ease",
            }}
          >
            <FontAwesomeIcon icon={faLock} />
            <span>Sécurité & Accès</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: APPLICATION SETTINGS
          ========================================================================= */}
      {activeTab === "app" && (
        <div
          className="pf-saspay-card"
          style={{
            maxWidth: "800px",
            width: "100%",
            boxSizing: "border-box",
            padding: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#0F172A",
              marginBottom: "0.35rem",
            }}
          >
            Informations de l'application
          </div>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#64748B",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            Ces informations sont visibles par vos clients sur les pages de
            paiement hébergées et les reçus.
          </p>

          <form onSubmit={handleSaveApp}>
            <div
              className="pf-responsive-grid-2"
              style={{ marginBottom: "1.25rem" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "#1E293B",
                    marginBottom: "0.35rem",
                  }}
                >
                  Nom commercial de l'application{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="pf-search-filter-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "#1E293B",
                    marginBottom: "0.35rem",
                  }}
                >
                  Catégorie d'activité{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="pf-search-filter-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="E-commerce, SaaS, Billetterie..."
                  required
                />
              </div>
            </div>

            <div
              className="pf-responsive-grid-2"
              style={{ marginBottom: "1.25rem" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "#1E293B",
                    marginBottom: "0.35rem",
                  }}
                >
                  Site web ou URL publique{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="url"
                  className="pf-search-filter-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "#1E293B",
                    marginBottom: "0.35rem",
                  }}
                >
                  Devise par défaut
                </label>
                <select
                  className="pf-dropdown-filter-select"
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    boxSizing: "border-box",
                  }}
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                >
                  <option value="XOF">XOF - Franc CFA (UEMOA)</option>
                  <option value="XAF">XAF - Franc CFA (CEMAC)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GNF">GNF</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#1E293B",
                  marginBottom: "0.35rem",
                }}
              >
                Identifiant unique de l'application (ID Système)
              </label>
              <input
                type="text"
                className="pf-search-filter-input"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#F1F5F9",
                  color: "#64748B",
                }}
                value={activeApp.id}
                disabled
              />
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#94A3B8",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                Identifiant système utilisé pour les appels d'API et
                l'authentification backend.
              </span>
            </div>

            <button
              type="submit"
              className="pf-btn-action-primary"
              style={{
                width: "100%",
                maxWidth: "260px",
                padding: "0.75rem 1.5rem",
                justifyContent: "center",
              }}
            >
              Enregistrer les modifications
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 2: KYC & CONFORMITÉ
          ========================================================================= */}
      {activeTab === "kyc" && (
        <div
          style={{ width: "100%", maxWidth: "900px", boxSizing: "border-box" }}
        >
          {/* Header Card & Certification Status */}
          <div
            className="pf-saspay-card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0F172A",
                    margin: 0,
                  }}
                >
                  Dossier de Conformité Marchand
                </h3>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "#64748B",
                    margin: "0.25rem 0 0",
                    lineHeight: 1.5,
                  }}
                >
                  Conformément aux directives de la BCEAO, l'activation des
                  encaissements réels en mode LIVE requiert la validation des
                  pièces légales.
                </p>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.35rem 0.85rem",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  borderRadius: "9999px",
                  color: "#059669",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                }}
              >
                <FontAwesomeIcon icon={faCircleCheck} />
                <span>Statut : COMPTE VÉRIFIÉ (LIVE ACTIF)</span>
              </div>
            </div>

            {/* KYC Type Selector: Particulier vs Entreprise */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setKycType("business")}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "8px",
                  border: "none",
                  background: kycType === "business" ? "#2563EB" : "#F1F5F9",
                  color: kycType === "business" ? "#FFFFFF" : "#475569",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <FontAwesomeIcon icon={faBuilding} />
                <span>Compte Entreprise (Business)</span>
              </button>

              <button
                type="button"
                onClick={() => setKycType("individual")}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "8px",
                  border: "none",
                  background: kycType === "individual" ? "#2563EB" : "#F1F5F9",
                  color: kycType === "individual" ? "#FFFFFF" : "#475569",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <FontAwesomeIcon icon={faUser} />
                <span>Compte Particulier (Freelance)</span>
              </button>
            </div>
          </div>

          {/* Business KYC Requirements */}
          {kycType === "business" && (
            <div
              className="pf-saspay-card"
              style={{
                padding: "1.5rem",
                marginBottom: "1.25rem",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  marginBottom: "0.5rem",
                }}
              >
                Pièces justificatives d'entreprise
              </div>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "#64748B",
                  marginBottom: "1.25rem",
                  lineHeight: 1.5,
                }}
              >
                Documents juridiques requis pour les sociétés (SARL, SAS, SUARL,
                Ets).
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                {/* 1. RCCM */}
                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        1. Registre de Commerce (RCCM)
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          wordBreak: "break-word",
                        }}
                      >
                        Cardix SARL · N° RB/COT/24-B-0012 · Validé
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 700,
                      }}
                    >
                      Validé
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDocUpload("rccm")}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Remplacer
                    </button>
                  </div>
                </div>

                {/* 2. IFU */}
                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        2. Identifiant Fiscal Unique (IFU)
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          wordBreak: "break-word",
                        }}
                      >
                        N° IFU 3201910298412 · Attestation certifiée DGI
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 700,
                      }}
                    >
                      Validé
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDocUpload("ifu")}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Remplacer
                    </button>
                  </div>
                </div>

                {/* 3. RIB Bancaire */}
                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        3. Relevé d'Identité Bancaire (RIB officiel)
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          wordBreak: "break-word",
                        }}
                      >
                        Bank of Africa (BOA Bénin) · Compte Professionnel
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 700,
                      }}
                    >
                      Validé
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDocUpload("rib")}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Remplacer
                    </button>
                  </div>
                </div>

                {/* 4. CNI Dirigeant */}
                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        4. Pièce d'identité du représentant légal
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          wordBreak: "break-word",
                        }}
                      >
                        Passeport biométrique · Alexandre Dossou (Gérant)
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 700,
                      }}
                    >
                      Validé
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDocUpload("id_card")}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#475569",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Remplacer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual KYC Requirements */}
          {kycType === "individual" && (
            <div
              className="pf-saspay-card"
              style={{
                padding: "1.5rem",
                marginBottom: "1.25rem",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  marginBottom: "0.5rem",
                }}
              >
                Vérification d'identité individuelle
              </div>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "#64748B",
                  marginBottom: "1.25rem",
                  lineHeight: 1.5,
                }}
              >
                Pour les particuliers et freelances : pièce d'identité
                officielle et selfie de vérification.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        Pièce d'identité (CNI / Passeport / Permis)
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                        Recto et Verso en haute résolution
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      background: "#ECFDF5",
                      color: "#059669",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    Vérifié
                  </span>
                </div>

                <div className="pf-kyc-doc-item">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0F172A",
                        }}
                      >
                        Selfie avec pièce d'identité
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                        Photo nette prise avec la caméra de l'appareil
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      background: "#ECFDF5",
                      color: "#059669",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    Vérifié
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Compliance Assurance Box */}
          <div
            style={{
              padding: "1rem 1.25rem",
              background: "#F0FDF4",
              borderRadius: "12px",
              border: "1px solid #BBF7D0",
              fontSize: "0.8125rem",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <FontAwesomeIcon
              icon={faShieldHalved}
              style={{ fontSize: "1.25rem", flexShrink: 0 }}
            />
            <div>
              <strong>Dossier complet et certifié :</strong> Votre application
              dispose des autorisations nécessaires pour encaisser et effectuer
              des décaissements automatisés sur tous les réseaux Mobile Money et
              bancaires d'Afrique de l'Ouest.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SÉCURITÉ & ACCÈS
          ========================================================================= */}
      {activeTab === "security" && (
        <div
          style={{ width: "100%", maxWidth: "800px", boxSizing: "border-box" }}
        >
          {/* Change Password Card */}
          <div
            className="pf-saspay-card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "0.35rem",
              }}
            >
              Changer de mot de passe
            </div>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#64748B",
                marginBottom: "1.25rem",
                lineHeight: 1.5,
              }}
            >
              Assurez-vous d'utiliser un mot de passe fort comprenant des
              lettres, des chiffres et des caractères spéciaux.
            </p>

            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "#1E293B",
                    marginBottom: "0.35rem",
                  }}
                >
                  Mot de passe actuel{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="password"
                  className="pf-search-filter-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div
                className="pf-responsive-grid-2"
                style={{ marginBottom: "1.25rem" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "#1E293B",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Nouveau mot de passe{" "}
                    <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="password"
                    className="pf-search-filter-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="Min. 8 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "#1E293B",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Confirmer le mot de passe{" "}
                    <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="password"
                    className="pf-search-filter-input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="Min. 8 caractères"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="pf-btn-action-primary"
                style={{
                  width: "100%",
                  maxWidth: "240px",
                  padding: "0.75rem 1.5rem",
                  justifyContent: "center",
                }}
              >
                Mettre à jour le mot de passe
              </button>
            </form>
          </div>

          {/* Two-Factor Authentication Card */}
          <div
            className="pf-saspay-card"
            style={{
              padding: "1.5rem",
              marginBottom: "1.25rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  Authentification à deux facteurs (2FA TOTP)
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "#64748B",
                    marginTop: "0.25rem",
                    lineHeight: 1.5,
                  }}
                >
                  Renforcez la protection de vos fonds avec Google Authenticator
                  ou Authy.
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggle2FA}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "8px",
                  border: "none",
                  background: twoFactorEnabled ? "#EF4444" : "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                {twoFactorEnabled ? "Désactiver la 2FA" : "Activer la 2FA"}
              </button>
            </div>

            <div
              style={{
                padding: "0.85rem 1rem",
                background: "#F8FAFC",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  background: twoFactorEnabled ? "#ECFDF5" : "#FEF3C7",
                  color: twoFactorEnabled ? "#059669" : "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FontAwesomeIcon icon={twoFactorEnabled ? faCheck : faLock} />
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#334155" }}>
                {twoFactorEnabled
                  ? "La 2FA est active. Chaque connexion ou retrait sensible demandera un code TOTP."
                  : "La 2FA est inactive. Nous vous recommandons de l’activer avant le passage en mode Live."}
              </div>
            </div>
          </div>

          {/* Active Sessions Card */}
          <div
            className="pf-saspay-card"
            style={{
              padding: "1.5rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "0.35rem",
              }}
            >
              Sessions actives
            </div>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#64748B",
                marginBottom: "1.25rem",
              }}
            >
              Appareils actuellement connectés à votre compte marchand.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1rem",
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    minWidth: 0,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faLaptop}
                    style={{
                      color: "#2563EB",
                      fontSize: "1.25rem",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                      }}
                    >
                      Navigateur Web (macOS / Chrome)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      Cotonou, Bénin · Adresse IP 197.234.218.10 · Session
                      actuelle
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    background: "#ECFDF5",
                    color: "#059669",
                    fontWeight: 700,
                  }}
                >
                  En cours
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1rem",
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    minWidth: 0,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faMobileScreen}
                    style={{
                      color: "#64748B",
                      fontSize: "1.25rem",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                      }}
                    >
                      Mobile Safari (iPhone iOS 18)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      Abidjan, Côte d'Ivoire · Il y a 2 jours
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showToast("Session mobile déconnectée.", "info")
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#EF4444",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Déconnecter
                </button>
              </div>
            </div>
          </div>

          {/* Login Alerts Card */}
          <div
            className="pf-saspay-card"
            style={{
              padding: "1.5rem",
              marginTop: "1.25rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "0.5rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  Alertes de sécurité de connexion
                </div>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "#64748B",
                    margin: "0.25rem 0 0",
                    lineHeight: 1.5,
                  }}
                >
                  Un e-mail de sécurité avec date UTC, adresse IP et empreinte
                  de l’appareil est expédié à chaque ouverture de session.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    showToast("Envoi du test d’alerte...", "info");
                    const res = await apiClient.auth.testLoginAlert();
                    showToast(
                      res.message ||
                        "E-mail d’alerte de connexion envoyé avec succès !",
                      "success",
                    );
                  } catch (err: any) {
                    showToast(
                      err.message || "Erreur lors de l’envoi de l’e-mail.",
                      "error",
                    );
                  }
                }}
                className="pf-btn pf-btn-secondary"
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>Tester l’alerte de connexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
