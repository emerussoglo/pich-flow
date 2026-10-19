import React, { useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faCheck,
  faRotate,
  faCreditCard,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "../ui/ToastContext";
import { DashboardLoadError } from "../ui/DashboardLoadError";
import { apiClient } from "../../lib/api";
import { Application, CheckoutSession } from "../../types";

interface CheckoutSessionsViewProps {
  appName?: string;
  activeApp?: Application;
}

export const CheckoutSessionsView: React.FC<CheckoutSessionsViewProps> = ({
  appName = "Mon Application",
  activeApp,
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const sessionLoadId = useRef(0);

  const loadSessions = useCallback(async () => {
    const loadId = ++sessionLoadId.current;
    const applicationId = activeApp?.id;
    if (!applicationId) {
      setSessions([]);
      setLoadError("");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setSessions([]);
    setLoadError("");
    try {
      const data = await apiClient.checkoutSessions.getAll(applicationId);
      if (loadId !== sessionLoadId.current) return;
      setSessions(data || []);
    } catch {
      if (loadId === sessionLoadId.current) {
        setLoadError("Impossible de charger les sessions de paiement.");
        showToast("Impossible de charger les sessions de paiement.", "error");
      }
    } finally {
      if (loadId === sessionLoadId.current) setIsLoading(false);
    }
  }, [activeApp?.id, showToast]);

  useEffect(() => {
    void loadSessions();
    return () => {
      sessionLoadId.current += 1;
    };
  }, [loadSessions]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Identifiant copié dans le presse-papier !", "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.id.toLowerCase().includes(term) ||
      (s.customerName && s.customerName.toLowerCase().includes(term)) ||
      (s.customerEmail && s.customerEmail.toLowerCase().includes(term)) ||
      (s.reference && s.reference.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {loadError && <DashboardLoadError message={loadError} onRetry={() => void loadSessions()} />}
      {/* Page Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Sessions de checkout</h1>
          <p className="pf-page-subtitle">
            Consultez toutes les sessions de paiement créées via vos liens de
            paiement et l'API de {appName}.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={loadSessions}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            title="Actualiser les sessions"
          >
            <FontAwesomeIcon icon={faRotate} spin={isLoading} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div
        className="pf-saspay-card"
        style={{ padding: "0.85rem 1.25rem", marginBottom: "1.25rem" }}
      >
        <input
          type="text"
          className="pf-search-filter-input"
          style={{ width: "100%", boxSizing: "border-box" }}
          placeholder="Rechercher par identifiant, client ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Empty State vs Real Table */}
      {filteredSessions.length === 0 ? (
        <div
          className="pf-saspay-card"
          style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}
        >
          <div
            style={{
              width: "4rem",
              height: "4rem",
              borderRadius: "50%",
              background: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
              fontSize: "1.5rem",
            }}
          >
            <FontAwesomeIcon icon={faCreditCard} />
          </div>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "#0F172A",
              marginBottom: "0.5rem",
            }}
          >
            Aucune session de checkout pour le moment
          </h3>
          <p
            style={{
              color: "#64748B",
              fontSize: "0.875rem",
              maxWidth: "460px",
              margin: "0 auto 1.5rem",
              lineHeight: "1.5",
            }}
          >
            Les sessions de paiement s'enregistrent automatiquement lorsque vos
            clients ouvrent vos liens de paiement ou initient une transaction
            via l'API.
          </p>
        </div>
      ) : (
        <div className="pf-saspay-table-wrapper">
          <div className="pf-table-scroll">
            <table className="pf-saspay-table">
              <thead>
                <tr>
                  <th>CLIENT</th>
                  <th>IDENTIFIANT DE SESSION</th>
                  <th>MONTANT</th>
                  <th>DATE DE CRÉATION</th>
                  <th>STATUT</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#0F172A",
                            fontSize: "0.875rem",
                          }}
                        >
                          {s.customerName}
                        </div>
                        {s.customerEmail && (
                          <div
                            style={{ fontSize: "0.75rem", color: "#64748B" }}
                          >
                            {s.customerEmail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: "#334155",
                            fontSize: "0.8125rem",
                          }}
                        >
                          {s.reference || s.id}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(s.reference || s.id, s.id)
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: copiedId === s.id ? "#16A34A" : "#94A3B8",
                            cursor: "pointer",
                            padding: "0.2rem",
                          }}
                          title="Copier la référence"
                        >
                          <FontAwesomeIcon
                            icon={copiedId === s.id ? faCheck : faCopy}
                          />
                        </button>
                        {s.paydunyaUrl && (
                          <a
                            href={s.paydunyaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#2563EB", marginLeft: "0.25rem" }}
                            title="Ouvrir le portail PayDunya Sandbox"
                          >
                            <FontAwesomeIcon
                              icon={faExternalLinkAlt}
                              style={{ fontSize: "0.75rem" }}
                            />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong
                        style={{ color: "#0F172A", fontSize: "0.875rem" }}
                      >
                        {s.amount.toLocaleString("fr-FR")} {s.currency}
                      </strong>
                    </td>
                    <td>
                      <span style={{ color: "#64748B", fontSize: "0.8125rem" }}>
                        {new Date(s.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pf-pill-status ${
                          s.status === "completed" || s.status === "Payée"
                            ? "reussi"
                            : s.status === "failed" || s.status === "Échouée"
                              ? "echoue"
                              : s.status === "expired" || s.status === "Expirée"
                                ? "expire"
                                : "en_attente"
                        }`}
                      >
                        {s.status === "completed" || s.status === "Payée"
                          ? "Payée"
                          : s.status === "failed" || s.status === "Échouée"
                            ? "Échouée"
                            : s.status === "expired" || s.status === "Expirée"
                              ? "Expirée"
                              : "En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
