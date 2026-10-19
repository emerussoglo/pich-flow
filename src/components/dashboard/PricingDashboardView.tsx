import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCreditCard,
  faMobileScreen,
  faBuildingColumns,
  faArrowRight,
  faCalculator,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "../ui/ToastContext";

export const PricingDashboardView: React.FC<{ appName?: string }> = ({
  appName = "Novia",
}) => {
  const { showToast } = useToast();
  const [testAmount, setTestAmount] = useState("50000");
  const [selectedRail, setSelectedRail] = useState("momo_bj");

  const rails = [
    {
      id: "momo_bj",
      label: "Mobile Money Bénin (MTN, Moov)",
      rate: 1.5,
      fixed: 0,
      currency: "XOF",
    },
    {
      id: "momo_ci",
      label: "Mobile Money Côte d’Ivoire (Wave, Orange, MTN)",
      rate: 1.5,
      fixed: 0,
      currency: "XOF",
    },
    {
      id: "momo_sn",
      label: "Mobile Money Sénégal (Wave, Free, Orange)",
      rate: 1.5,
      fixed: 0,
      currency: "XOF",
    },
    {
      id: "card_intl",
      label: "Cartes bancaires (Visa, Mastercard, GIM-UEMOA)",
      rate: 2.5,
      fixed: 100,
      currency: "XOF",
    },
    {
      id: "payout_momo",
      label: "Retrait Mobile Money (Payout)",
      rate: 1.0,
      fixed: 150,
      currency: "XOF",
    },
    {
      id: "payout_bank",
      label: "Virement bancaire professionnel",
      rate: 1.0,
      fixed: 500,
      currency: "XOF",
    },
  ];

  const currentRail = rails.find((r) => r.id === selectedRail) || rails[0];
  const numAmount = Math.max(0, Number(testAmount) || 0);
  const feeCalc =
    Math.round((numAmount * currentRail.rate) / 100) + currentRail.fixed;
  const netCalc = Math.max(0, numAmount - feeCalc);

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Tarification & Frais</h1>
          <p className="pf-page-subtitle">
            Grille tarifaire appliquée à {appName} selon les moyens de paiement
            et les pays.
          </p>
        </div>
      </div>

      {/* Grid of rails */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Mobile Money */}
        <div className="pf-saspay-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: "2.25rem",
                height: "2.25rem",
                borderRadius: "8px",
                background: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faMobileScreen} />
            </div>
            <div>
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: "#0F172A",
                  display: "block",
                }}
              >
                Mobile Money Afrique
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                UEMOA & CEMAC (Bénin, CI, Sénégal...)
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#2563EB",
              marginBottom: "0.25rem",
            }}
          >
            1.5%
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Aucun frais fixe par transaction. Encaissement instantané 24/7.
          </div>
        </div>

        {/* Cartes bancaires */}
        <div className="pf-saspay-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: "2.25rem",
                height: "2.25rem",
                borderRadius: "8px",
                background: "#F0FDF4",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
            <div>
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: "#0F172A",
                  display: "block",
                }}
              >
                Cartes Bancaires
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Visa, Mastercard & Cartes régionales
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#16A34A",
              marginBottom: "0.25rem",
            }}
          >
            2.5%{" "}
            <span
              style={{ fontSize: "0.9rem", color: "#64748B", fontWeight: 600 }}
            >
              + 100 XOF
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Sécurisé 3D-Secure 2.0. Détection antifraude automatique.
          </div>
        </div>

        {/* Décaissements */}
        <div className="pf-saspay-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: "2.25rem",
                height: "2.25rem",
                borderRadius: "8px",
                background: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FontAwesomeIcon icon={faBuildingColumns} />
            </div>
            <div>
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: "#0F172A",
                  display: "block",
                }}
              >
                Retraits & Décaissements
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Mobile Money & Comptes bancaires
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#D97706",
              marginBottom: "0.25rem",
            }}
          >
            1.0%{" "}
            <span
              style={{ fontSize: "0.9rem", color: "#64748B", fontWeight: 600 }}
            >
              + 150 XOF
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Traitement automatique ou programmé selon vos préférences.
          </div>
        </div>
      </div>

      {/* Simulator Card */}
      <div
        className="pf-saspay-card"
        style={{ padding: "1.5rem", marginBottom: "2rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <FontAwesomeIcon
            icon={faCalculator}
            style={{ color: "#2563EB", fontSize: "1.1rem" }}
          />
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#0F172A",
              margin: 0,
            }}
          >
            Simulateur de commissions en temps réel
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          <div>
            <label className="pf-label">Méthode de paiement</label>
            <select
              className="pf-select"
              value={selectedRail}
              onChange={(e) => setSelectedRail(e.target.value)}
            >
              {rails.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.rate}%{" "}
                  {r.fixed > 0 ? `+ ${r.fixed} ${r.currency}` : ""})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="pf-label">Montant de la transaction (XOF)</label>
            <input
              type="number"
              className="pf-input"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              min="100"
              step="500"
            />
          </div>

          <div
            style={{
              background: "#F8FAFC",
              padding: "1rem",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.4rem",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ color: "#64748B" }}>
                Frais PichFlow ({currentRail.rate}%) :
              </span>
              <strong style={{ color: "#EF4444" }}>
                - {new Intl.NumberFormat("fr-FR").format(feeCalc)} XOF
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1rem",
                paddingTop: "0.4rem",
                borderTop: "1px solid #E2E8F0",
              }}
            >
              <span style={{ fontWeight: 700, color: "#0F172A" }}>
                Net perçu :
              </span>
              <strong style={{ color: "#16A34A", fontSize: "1.15rem" }}>
                {new Intl.NumberFormat("fr-FR").format(netCalc)} XOF
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
