import React, { useState } from "react";
import { Application, PaymentLink, Withdrawal, Wallet } from "../../types";
import { apiClient } from "../../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faPlus,
  faBuildingColumns,
  faMobileScreen,
  faArrowRight,
  faArrowLeft,
  faCheck,
  faCloudArrowUp,
  faCamera,
  faIdCard,
  faBuilding,
  faUser,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "../ui/ToastContext";

// 1. MODAL: NOUVELLE APPLICATION AVEC FLUX DE VÉRIFICATION INTÉGRÉ
interface NewAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (app: Application) => void;
}

export const NewAppModal: React.FC<NewAppModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const { showToast } = useToast();

  // Multi-step: 1 = App details, 2 = Profil (Particulier/Business), 3 = KYC verification
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: App details
  const [appName, setAppName] = useState("");
  const [appCategory, setAppCategory] = useState("E-commerce");
  const [appUrl, setAppUrl] = useState("");

  // Step 2: Account type
  const [accountType, setAccountType] = useState<"particulier" | "business">(
    "particulier",
  );

  // Step 3: Identity & Business verification
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [docType, setDocType] = useState<"cni" | "passeport" | "permis">("cni");
  const [rectoUploaded, setRectoUploaded] = useState(false);
  const [versoUploaded, setVersoUploaded] = useState(false);
  const [selfieTaken, setSelfieTaken] = useState(false);

  // Business only
  const [companyName, setCompanyName] = useState("");
  const [rccmNumber, setRccmNumber] = useState("");
  const [ifuNumber, setIfuNumber] = useState("");
  const [rccmDocUploaded, setRccmDocUploaded] = useState(false);

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File names for display
  const [rectoFileName, setRectoFileName] = useState("");
  const [versoFileName, setVersoFileName] = useState("");
  const [selfieFileName, setSelfieFileName] = useState("");
  const [rccmFileName, setRccmFileName] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setStep(1);
    setAppName("");
    setAppCategory("E-commerce");
    setAppUrl("");
    setAccountType("particulier");
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setDocType("cni");
    setRectoUploaded(false);
    setVersoUploaded(false);
    setSelfieTaken(false);
    setCompanyName("");
    setRccmNumber("");
    setIfuNumber("");
    setRccmDocUploaded(false);
    setTermsAccepted(false);
    setRectoFileName("");
    setVersoFileName("");
    setSelfieFileName("");
    setRccmFileName("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      showToast("Veuillez renseigner le nom de l'application.", "error");
      return;
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    setStep(3);
  };

  const handleFileChange = async (
    docTypeKey: "id_recto" | "id_verso" | "selfie" | "rccm",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast(
        "Le fichier dépasse la taille maximale autorisée de 10 Mo.",
        "error",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await apiClient.settings.uploadDoc(docTypeKey, file.name, base64);
        if (docTypeKey === "id_recto") {
          setRectoUploaded(true);
          setRectoFileName(file.name);
        } else if (docTypeKey === "id_verso") {
          setVersoUploaded(true);
          setVersoFileName(file.name);
        } else if (docTypeKey === "selfie") {
          setSelfieTaken(true);
          setSelfieFileName(file.name);
        } else if (docTypeKey === "rccm") {
          setRccmDocUploaded(true);
          setRccmFileName(file.name);
        }
        showToast(`${file.name} téléversé avec succès !`, "success");
      } catch (err: any) {
        showToast(err.message || "Erreur lors du téléversement.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      showToast(
        "Veuillez accepter les conditions générales de PichFlow.",
        "warning",
      );
      return;
    }

    if (!rectoUploaded || !versoUploaded || !selfieTaken) {
      showToast(
        "Veuillez joindre la pièce (Recto, Verso) et votre Selfie de conformité.",
        "warning",
      );
      return;
    }

    if (accountType === "business" && (!companyName || !rccmNumber)) {
      showToast(
        "Veuillez renseigner les informations de l'entreprise (Nom et RCCM).",
        "warning",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create real application in backend database
      const createdApp = await apiClient.apps.create({
        name: appName.trim(),
        category: appCategory,
        website: appUrl || "",
        environment: "test",
        currency: "XOF",
      });

      // 2. Submit real KYC dossier in database
      await apiClient.settings.saveKyc({
        accountType,
        companyName,
        rccmNumber,
        ifuNumber,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        birthDate,
        idType: docType,
      });

      onCreate(createdApp);
      showToast(
        `Application "${createdApp.name}" créée et dossier KYC soumis avec succès !`,
        "success",
      );
      handleClose();
    } catch (err: any) {
      showToast(
        err.message || "Erreur lors de la création de l’application.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pf-modal-overlay" onClick={handleClose}>
      <div
        className="pf-modal-content"
        style={{ maxWidth: "640px", width: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="pf-modal-header">
          <div>
            <h3
              className="pf-card-title"
              style={{ fontSize: "1.25rem", fontWeight: 800 }}
            >
              {step === 1 && "Créer une application"}
              {step === 2 && "Comment veux-tu encaisser ?"}
              {step === 3 && "Demande de vérification d'identité"}
            </h3>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--pf-muted)",
                marginTop: "0.2rem",
              }}
            >
              Étape {step} sur 3 •{" "}
              {step === 1
                ? "Configuration initiale"
                : step === 2
                  ? "Choix du statut de compte"
                  : "Conformité & Pièces justificatives"}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="pf-modal-close"
            aria-label="Fermer"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* STEP 1: Application Basics */}
        {step === 1 && (
          <form onSubmit={handleStep1Next}>
            <div className="pf-form-group">
              <label className="pf-label">Nom de l'application *</label>
              <input
                type="text"
                className="pf-input"
                placeholder="Ex: Cadis, Novia, Mon SaaS..."
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                required
                autoFocus
              />
              <span className="pf-helper-text">
                Ce nom identifiera votre application sur vos reçus et tableaux
                de bord.
              </span>
            </div>

            <div className="pf-form-group">
              <label className="pf-label">URL du site web (Optionnel)</label>
              <input
                type="url"
                className="pf-input"
                placeholder="https://votre-site.com"
                value={appUrl}
                onChange={(e) => setAppUrl(e.target.value)}
              />
            </div>

            <div className="pf-form-group">
              <label className="pf-label">Catégorie *</label>
              <select
                className="pf-select"
                value={appCategory}
                onChange={(e) => setAppCategory(e.target.value)}
              >
                <option value="E-commerce">E-commerce</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
                <option value="Éducation">Éducation</option>
                <option value="Santé">Santé</option>
                <option value="IA et autres">IA et autres technologies</option>
                <option value="Réseaux sociaux">Réseaux sociaux</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem" }}>
              <button
                type="button"
                onClick={handleClose}
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
                <span>Continuer</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Choose Account Tier (Particulier vs Business) */}
        {step === 2 && (
          <div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--pf-muted)",
                marginBottom: "1.25rem",
              }}
            >
              Sélectionnez le volume mensuel estimé pour votre application{" "}
              <strong>{appName}</strong> :
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              {/* Particulier */}
              <div
                onClick={() => setAccountType("particulier")}
                style={{
                  padding: "1.25rem",
                  borderRadius: "14px",
                  border:
                    accountType === "particulier"
                      ? "2px solid #2563EB"
                      : "1px solid var(--pf-border)",
                  background:
                    accountType === "particulier"
                      ? "#EFF6FF"
                      : "var(--pf-surface)",
                  cursor: "pointer",
                  transition: "all 180ms ease",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "8px",
                      background:
                        accountType === "particulier" ? "#2563EB" : "#F1F5F9",
                      color:
                        accountType === "particulier" ? "#FFFFFF" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <strong style={{ fontSize: "1rem", color: "var(--pf-text)" }}>
                    Particulier
                  </strong>
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "#2563EB",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Limité à 1 000 000 FCFA / mois
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--pf-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Idéal pour freelances, créateurs et ventes occasionnelles.
                  Vérification rapide avec pièce d'identité.
                </div>
              </div>

              {/* Business */}
              <div
                onClick={() => setAccountType("business")}
                style={{
                  padding: "1.25rem",
                  borderRadius: "14px",
                  border:
                    accountType === "business"
                      ? "2px solid #2563EB"
                      : "1px solid var(--pf-border)",
                  background:
                    accountType === "business"
                      ? "#EFF6FF"
                      : "var(--pf-surface)",
                  cursor: "pointer",
                  transition: "all 180ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "8px",
                      background:
                        accountType === "business" ? "#2563EB" : "#F1F5F9",
                      color: accountType === "business" ? "#FFFFFF" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FontAwesomeIcon icon={faBuilding} />
                  </div>
                  <strong style={{ fontSize: "1rem", color: "var(--pf-text)" }}>
                    Business
                  </strong>
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "#2563EB",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Jusqu'à 50 000 000 FCFA / mois
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--pf-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Pour sociétés, startups SaaS et commerces enregistrés (RCCM &
                  IFU). Plafonds élevés et support prioritaire.
                </div>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="pf-btn pf-btn-secondary pf-btn-md"
                style={{ flex: 1 }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Retour</span>
              </button>
              <button
                type="button"
                onClick={handleStep2Next}
                className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                style={{ flex: 1 }}
              >
                <span>Continuer la vérification</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: KYC & Document Verification */}
        {step === 3 && (
          <form
            onSubmit={handleFinalSubmit}
            style={{
              maxHeight: "70vh",
              overflowY: "auto",
              paddingRight: "0.25rem",
            }}
          >
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "10px",
                fontSize: "0.8125rem",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <FontAwesomeIcon
                icon={faShieldHalved}
                style={{ color: "#16A34A" }}
              />
              <span>
                Vérification d'identité pour le compte{" "}
                <strong>
                  {accountType === "particulier"
                    ? "Particulier (1M FCFA/mois)"
                    : "Business (50M FCFA/mois)"}
                </strong>
              </span>
            </div>

            {/* Personal Info */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div className="pf-form-group">
                <label className="pf-label">Prénom *</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder="Ex: Koffi"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Nom *</label>
                <input
                  type="text"
                  className="pf-input"
                  placeholder="Ex: Mensah"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div className="pf-form-group">
                <label className="pf-label">Date de naissance *</label>
                <input
                  type="date"
                  className="pf-input"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
              </div>

              <div className="pf-form-group">
                <label className="pf-label">Type de pièce d'identité *</label>
                <select
                  className="pf-select"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                >
                  <option value="cni">Carte Nationale d'Identité (CNI)</option>
                  <option value="passeport">Passeport biométrique</option>
                  <option value="permis">Permis de conduire</option>
                </select>
              </div>
            </div>

            {/* Business Specific Details */}
            {accountType === "business" && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "1rem",
                  background: "#F8FAFC",
                  borderRadius: "12px",
                  border: "1px solid var(--pf-border)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    color: "var(--pf-text)",
                    marginBottom: "0.75rem",
                  }}
                >
                  Informations de l'entreprise
                </div>

                <div className="pf-form-group">
                  <label className="pf-label">
                    Raison sociale / Nom légal *
                  </label>
                  <input
                    type="text"
                    className="pf-input"
                    placeholder="Ex: Novia Technologies SARL"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="pf-form-group">
                    <label className="pf-label">Numéro RCCM *</label>
                    <input
                      type="text"
                      className="pf-input"
                      placeholder="Ex: RB/COT/24 B 1980"
                      value={rccmNumber}
                      onChange={(e) => setRccmNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pf-form-group">
                    <label className="pf-label">
                      Numéro IFU / NIF (Fiscal)
                    </label>
                    <input
                      type="text"
                      className="pf-input"
                      placeholder="Ex: 0202111234567"
                      value={ifuNumber}
                      onChange={(e) => setIfuNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pf-form-group" style={{ marginBottom: 0 }}>
                  <label className="pf-label">
                    Document Registre de Commerce (RCCM / Déclaration) - Max 10
                    Mo
                  </label>
                  <label
                    style={{
                      display: "block",
                      padding: "0.85rem",
                      border: rccmDocUploaded
                        ? "2px dashed #16A34A"
                        : "2px dashed var(--pf-border)",
                      borderRadius: "10px",
                      textAlign: "center",
                      background: rccmDocUploaded ? "#F0FDF4" : "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange("rccm", e)}
                      style={{ display: "none" }}
                    />
                    <FontAwesomeIcon
                      icon={rccmDocUploaded ? faCheck : faCloudArrowUp}
                      style={{
                        color: rccmDocUploaded ? "#16A34A" : "#2563EB",
                        marginBottom: "0.25rem",
                      }}
                    />
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      {rccmDocUploaded
                        ? `${rccmFileName || "Extrait_RCCM.pdf"} (Validé)`
                        : "Cliquer pour téléverser votre extrait RCCM (PDF, PNG, JPG)"}
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Document Uploads (Recto, Verso, Selfie) */}
            <div style={{ marginTop: "1rem" }}>
              <label
                className="pf-label"
                style={{ marginBottom: "0.5rem", display: "block" }}
              >
                Pièces justificatives requises (Max 10 Mo par fichier) :
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.75rem",
                }}
              >
                {/* Recto */}
                <label
                  style={{
                    display: "block",
                    padding: "0.75rem 0.5rem",
                    border: rectoUploaded
                      ? "2px solid #16A34A"
                      : "1px dashed var(--pf-border)",
                    borderRadius: "10px",
                    textAlign: "center",
                    background: rectoUploaded ? "#F0FDF4" : "var(--pf-surface)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange("id_recto", e)}
                    style={{ display: "none" }}
                  />
                  <FontAwesomeIcon
                    icon={rectoUploaded ? faCheck : faIdCard}
                    style={{
                      color: rectoUploaded ? "#16A34A" : "#2563EB",
                      fontSize: "1.25rem",
                      marginBottom: "0.35rem",
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                    Recto
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: rectoUploaded ? "#166534" : "var(--pf-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rectoUploaded
                      ? rectoFileName || "Fichier joint"
                      : "Sélectionner"}
                  </div>
                </label>

                {/* Verso */}
                <label
                  style={{
                    display: "block",
                    padding: "0.75rem 0.5rem",
                    border: versoUploaded
                      ? "2px solid #16A34A"
                      : "1px dashed var(--pf-border)",
                    borderRadius: "10px",
                    textAlign: "center",
                    background: versoUploaded ? "#F0FDF4" : "var(--pf-surface)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange("id_verso", e)}
                    style={{ display: "none" }}
                  />
                  <FontAwesomeIcon
                    icon={versoUploaded ? faCheck : faIdCard}
                    style={{
                      color: versoUploaded ? "#16A34A" : "#2563EB",
                      fontSize: "1.25rem",
                      marginBottom: "0.35rem",
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                    Verso
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: versoUploaded ? "#166534" : "var(--pf-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {versoUploaded
                      ? versoFileName || "Fichier joint"
                      : "Sélectionner"}
                  </div>
                </label>

                {/* Selfie */}
                <label
                  style={{
                    display: "block",
                    padding: "0.75rem 0.5rem",
                    border: selfieTaken
                      ? "2px solid #16A34A"
                      : "1px dashed var(--pf-border)",
                    borderRadius: "10px",
                    textAlign: "center",
                    background: selfieTaken ? "#F0FDF4" : "var(--pf-surface)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => handleFileChange("selfie", e)}
                    style={{ display: "none" }}
                  />
                  <FontAwesomeIcon
                    icon={selfieTaken ? faCheck : faCamera}
                    style={{
                      color: selfieTaken ? "#16A34A" : "#2563EB",
                      fontSize: "1.25rem",
                      marginBottom: "0.35rem",
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                    Selfie
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: selfieTaken ? "#166534" : "var(--pf-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selfieTaken
                      ? selfieFileName || "Photo capturée"
                      : "Prendre photo"}
                  </div>
                </label>
              </div>
            </div>

            {/* Terms checkbox */}
            <div style={{ marginTop: "1.25rem" }}>
              <label
                className="pf-checkbox-label"
                style={{ alignItems: "flex-start" }}
              >
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: "0.2rem" }}
                />
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--pf-text)",
                    lineHeight: 1.4,
                  }}
                >
                  J'accepte les conditions générales d'utilisation de PichFlow
                  et certifie sur l'honneur l'exactitude des informations
                  d'identité et de société fournies.
                </span>
              </label>
            </div>

            <div
              style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem" }}
            >
              <button
                type="button"
                onClick={() => setStep(2)}
                className="pf-btn pf-btn-secondary pf-btn-md"
                style={{ flex: 1 }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Retour</span>
              </button>
              <button
                type="submit"
                className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
                style={{ flex: 1 }}
              >
                <span>Valider l'application</span>
                <FontAwesomeIcon icon={faCheck} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// 2. MODAL: NOUVEAU LIEN DE PAIEMENT (MULTI-DEVISES ET MONTANT LIBRE/FIXE)
interface NewPaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (link: PaymentLink) => void;
}

export const NewPaymentLinkModal: React.FC<NewPaymentLinkModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFixed, setIsFixed] = useState(true);
  const [amount, setAmount] = useState("15000");
  const [currency, setCurrency] = useState("XOF");
  const [country, setCountry] = useState("Bénin");
  const { showToast } = useToast();

  if (!isOpen) return null;

  const currencyOptions = [
    {
      code: "XOF",
      label: "XOF - Franc CFA (UEMOA: Bénin, CI, Sénégal, Togo...)",
    },
    {
      code: "XAF",
      label: "XAF - Franc CFA (CEMAC: Cameroun, Gabon, Congo...)",
    },
    { code: "GNF", label: "GNF - Franc Guinéen" },
    { code: "CDF", label: "CDF - Franc Congolais" },
    { code: "RWF", label: "RWF - Franc Rwandais" },
    { code: "USD", label: "USD - Dollar Américain ($)" },
    { code: "EUR", label: "EUR - Euro (€)" },
    { code: "NGN", label: "NGN - Naira Nigérian (₦)" },
    { code: "GHS", label: "GHS - Cedi Ghanéen (GH₵)" },
    { code: "KES", label: "KES - Shilling Kenyan (KSh)" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    const newLink: PaymentLink = {
      id: `pl_${Date.now()}`,
      slug,
      title: title.trim(),
      description: description.trim(),
      amount: isFixed ? Number(amount) : null,
      isFixedAmount: isFixed,
      currency,
      country,
      status: "active",
      usageCount: 0,
      usageLimit: null,
      requirePhone: true,
      createdAt: new Date().toISOString(),
    };

    onCreate(newLink);
    onClose();
    setTitle("");
    setDescription("");
    showToast(
      `Lien de paiement créé (${currency}) ! URL : /pay/${newLink.slug}`,
      "success",
    );
  };

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-header">
          <h3 className="pf-card-title">Créer un lien de paiement</h3>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label="Fermer"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pf-form-group">
            <label className="pf-label">Titre du paiement ou produit *</label>
            <input
              type="text"
              className="pf-input"
              placeholder="Ex: Abonnement Pro, Commande #1042, Don..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="pf-form-group">
            <label className="pf-label">Description pour vos clients</label>
            <textarea
              className="pf-textarea"
              rows={2}
              placeholder="Ex: Accès immédiat après confirmation automatique du paiement."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pf-form-group">
            <label className="pf-label">Devise d'encaissement *</label>
            <select
              className="pf-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencyOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pf-form-group">
            <label className="pf-label">Type de montant</label>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
              <label className="pf-checkbox-label">
                <input
                  type="radio"
                  name="amountType"
                  checked={isFixed}
                  onChange={() => setIsFixed(true)}
                />
                <span>Montant fixe</span>
              </label>
              <label className="pf-checkbox-label">
                <input
                  type="radio"
                  name="amountType"
                  checked={!isFixed}
                  onChange={() => setIsFixed(false)}
                />
                <span>Montant libre (le client choisit)</span>
              </label>
            </div>
          </div>

          {isFixed && (
            <div className="pf-form-group">
              <label className="pf-label">Montant ({currency}) *</label>
              <input
                type="number"
                className="pf-input"
                min="100"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={onClose}
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
              Générer le lien
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. MODAL: DEMANDE DE RETRAIT (PAYOUT)
interface NewWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  onCreate: (wdr: Withdrawal) => void;
}

export const NewWithdrawalModal: React.FC<NewWithdrawalModalProps> = ({
  isOpen,
  onClose,
  wallets,
  onCreate,
}) => {
  const [methodType, setMethodType] = useState<
    "mobile_money" | "bank_transfer"
  >("mobile_money");
  const [amount, setAmount] = useState("500000");
  const [recipientName, setRecipientName] = useState(
    "Alexandre Dossou (Cardix SARL)",
  );
  const [phoneOrIban, setPhoneOrIban] = useState("+229 97 00 22 11");
  const [operatorOrBank, setOperatorOrBank] = useState("MTN MoMo Bénin");
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    const fee = Math.round(numAmount * 0.01) + 150; // 1% + 150 XOF
    const netAmount = numAmount - fee;

    const newWithdrawal: Withdrawal = {
      id: `wdr_${Date.now()}`,
      reference: `PF-WDR-2026-00${Math.floor(Math.random() * 90 + 10)}`,
      amount: numAmount,
      currency: "XOF",
      fee,
      netAmount,
      methodType,
      recipientName,
      recipientPhoneOrIban: phoneOrIban,
      operatorOrBank,
      country: "Bénin",
      status: "processing",
      createdAt: new Date().toISOString(),
    };

    onCreate(newWithdrawal);
    onClose();
    showToast(
      `Demande de retrait de ${new Intl.NumberFormat("fr-FR").format(numAmount)} XOF enregistrée !`,
      "success",
    );
  };

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-header">
          <h3 className="pf-card-title">Demander un retrait de fonds</h3>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label="Fermer"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pf-form-group">
            <label className="pf-label">Type de virement</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <div
                onClick={() => {
                  setMethodType("mobile_money");
                  setOperatorOrBank("MTN MoMo Bénin");
                  setPhoneOrIban("+229 97 00 22 11");
                }}
                className={`pf-method-option ${methodType === "mobile_money" ? "selected" : ""}`}
              >
                <FontAwesomeIcon
                  icon={faMobileScreen}
                  style={{ color: "#2563EB" }}
                />
                <span style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                  Mobile Money
                </span>
              </div>

              <div
                onClick={() => {
                  setMethodType("bank_transfer");
                  setOperatorOrBank("Bank of Africa (BOA Bénin)");
                  setPhoneOrIban("BJ061 01001 001234567890 12");
                }}
                className={`pf-method-option ${methodType === "bank_transfer" ? "selected" : ""}`}
              >
                <FontAwesomeIcon
                  icon={faBuildingColumns}
                  style={{ color: "#2563EB" }}
                />
                <span style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                  Compte Bancaire
                </span>
              </div>
            </div>
          </div>

          <div className="pf-form-group">
            <label className="pf-label">Montant à retirer (XOF)</label>
            <input
              type="number"
              className="pf-input"
              min="5000"
              max="4850000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <span className="pf-helper-text">
              Solde disponible : 4 850 000 XOF
            </span>
          </div>

          <div className="pf-form-group">
            <label className="pf-label">
              Nom du titulaire ou raison sociale
            </label>
            <input
              type="text"
              className="pf-input"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
            />
          </div>

          <div className="pf-form-group">
            <label className="pf-label">
              {methodType === "mobile_money"
                ? "Numéro de téléphone marchand"
                : "RIB / Numéro de compte IBAN"}
            </label>
            <input
              type="text"
              className="pf-input"
              value={phoneOrIban}
              onChange={(e) => setPhoneOrIban(e.target.value)}
              required
            />
          </div>

          <div className="pf-form-group">
            <label className="pf-label">Opérateur ou Banque</label>
            <input
              type="text"
              className="pf-input"
              value={operatorOrBank}
              onChange={(e) => setOperatorOrBank(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={onClose}
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
              Confirmer le retrait
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
