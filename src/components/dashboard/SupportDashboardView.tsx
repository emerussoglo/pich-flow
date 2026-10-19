import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleQuestion,
  faCommentDots,
  faEnvelope,
  faPhone,
  faArrowUpRightFromSquare,
  faCheckCircle,
  faPlus,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "../ui/ToastContext";
import { useRouter } from "../../lib/router";

export const SupportDashboardView: React.FC<{ appName?: string }> = ({
  appName = "Novia",
}) => {
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState(
    "Paiements & Transactions",
  );
  const [ticketMessage, setTicketMessage] = useState("");
  const [tickets, setTickets] = useState([
    {
      id: "TICK-802",
      subject: "Augmentation du plafond mensuel Business",
      category: "Compte & KYC",
      status: "Résolu",
      date: "08 oct. 2026",
    },
    {
      id: "TICK-801",
      subject: "Délai d’approbation du webhook MTN MoMo",
      category: "Technique",
      status: "Résolu",
      date: "05 oct. 2026",
    },
  ]);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      showToast("Veuillez renseigner un objet et votre message.", "error");
      return;
    }

    const newTicket = {
      id: `TICK-${Math.floor(Math.random() * 900 + 100)}`,
      subject: ticketSubject.trim(),
      category: ticketCategory,
      status: "En cours",
      date: "Aujourd'hui",
    };

    setTickets([newTicket, ...tickets]);
    setTicketSubject("");
    setTicketMessage("");
    showToast(
      `Ticket #${newTicket.id} ouvert ! Un conseiller PichFlow vous répondra sous 2h.`,
      "success",
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="pf-page-head-row">
        <div>
          <h1 className="pf-page-title">Support & Assistance</h1>
          <p className="pf-page-subtitle">
            Une équipe dédiée pour accompagner la croissance de {appName}.
          </p>
        </div>

        <button
          onClick={() => navigate("/documentation")}
          className="pf-btn-action-secondary"
        >
          <span>Consulter la Documentation</span>
          <FontAwesomeIcon
            icon={faArrowUpRightFromSquare}
            style={{ fontSize: "0.75rem" }}
          />
        </button>
      </div>

      {/* System Status Banner */}
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          padding: "0.85rem 1.25rem",
          borderRadius: "12px",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <FontAwesomeIcon
            icon={faCheckCircle}
            style={{ color: "#16A34A", fontSize: "1.1rem" }}
          />
          <div>
            <strong
              style={{
                fontSize: "0.875rem",
                color: "#166534",
                display: "block",
              }}
            >
              Tous les services de paiement sont 100% opérationnels
            </strong>
            <span style={{ fontSize: "0.75rem", color: "#15803D" }}>
              API Gateway · Mobile Money Bénin, CI, Sénégal · Passerelle Cartes
              · Webhooks (Disponibilité 99.98%)
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#166534",
            background: "#DCFCE7",
            padding: "0.2rem 0.6rem",
            borderRadius: "20px",
          }}
        >
          Uptime 99.98%
        </span>
      </div>

      {/* 2 Columns: Contact Options + New Ticket Form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Contact Channels */}
        <div>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: "0.75rem",
            }}
          >
            Canaux d’assistance directe
          </h2>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {/* WhatsApp */}
            <div
              className="pf-saspay-card"
              style={{
                padding: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    background: "#DCFCE7",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  <FontAwesomeIcon icon={faCommentDots} />
                </div>
                <div>
                  <strong
                    style={{
                      fontSize: "0.875rem",
                      color: "#0F172A",
                      display: "block",
                    }}
                  >
                    WhatsApp Support Développeurs
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    +229 97 00 22 11 · Réponse en direct
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  showToast(
                    "Redirection vers WhatsApp Support (+229)...",
                    "info",
                  )
                }
                className="pf-btn pf-btn-secondary pf-btn-sm"
              >
                Discuter
              </button>
            </div>

            {/* Email */}
            <div
              className="pf-saspay-card"
              style={{
                padding: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    background: "#EFF6FF",
                    color: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <div>
                  <strong
                    style={{
                      fontSize: "0.875rem",
                      color: "#0F172A",
                      display: "block",
                    }}
                  >
                    Support par Email
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    support@pichflow.com
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  showToast("Email de support : support@pichflow.com", "info")
                }
                className="pf-btn pf-btn-secondary pf-btn-sm"
              >
                Écrire
              </button>
            </div>

            {/* Phone */}
            <div
              className="pf-saspay-card"
              style={{
                padding: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    background: "#FEF3C7",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <div>
                  <strong
                    style={{
                      fontSize: "0.875rem",
                      color: "#0F172A",
                      display: "block",
                    }}
                  >
                    Ligne d’Urgence Marchand
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Disponible de 8h à 20h UTC
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  showToast("Ligne téléphonique : +229 21 30 00 00", "info")
                }
                className="pf-btn pf-btn-secondary pf-btn-sm"
              >
                Appeler
              </button>
            </div>
          </div>
        </div>

        {/* Create Ticket Form */}
        <div className="pf-saspay-card" style={{ padding: "1.25rem" }}>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: "0.75rem",
            }}
          >
            Ouvrir un ticket d’assistance
          </h2>

          <form onSubmit={handleSubmitTicket}>
            <div className="pf-form-group">
              <label className="pf-label">Catégorie de la demande</label>
              <select
                className="pf-select"
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
              >
                <option value="Paiements & Transactions">
                  Paiements & Transactions
                </option>
                <option value="Intégration API & Webhooks">
                  Intégration API & Webhooks
                </option>
                <option value="Retraits & Versements (Payouts)">
                  Retraits & Versements (Payouts)
                </option>
                <option value="Compte & KYC">
                  Compte & KYC (Vérification d’identité)
                </option>
                <option value="Facturation & Frais">Facturation & Frais</option>
              </select>
            </div>

            <div className="pf-form-group">
              <label className="pf-label">Objet *</label>
              <input
                type="text"
                className="pf-input"
                placeholder="Ex: Problème de notification webhook sur MTN..."
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                required
              />
            </div>

            <div className="pf-form-group">
              <label className="pf-label">Description détaillée *</label>
              <textarea
                className="pf-textarea"
                rows={3}
                placeholder="Décrivez votre question ou problème en précisant si possible l'ID de transaction ou l'URL concernée."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="pf-btn pf-btn-primary pf-btn-md pf-btn-shine"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.45rem",
              }}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              <span>Envoyer le ticket</span>
            </button>
          </form>
        </div>
      </div>

      {/* Tickets History */}
      <div>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: "0.75rem",
          }}
        >
          Historique de vos tickets
        </h2>

        <div className="pf-saspay-table-wrapper">
          <div className="pf-table-scroll">
            <table className="pf-saspay-table">
              <thead>
                <tr>
                  <th>RÉFÉRENCE</th>
                  <th>OBJET</th>
                  <th>CATÉGORIE</th>
                  <th>DATE</th>
                  <th>STATUT</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong
                        style={{ color: "#2563EB", fontFamily: "monospace" }}
                      >
                        {t.id}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>
                        {t.subject}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#64748B" }}>{t.category}</span>
                    </td>
                    <td>
                      <span style={{ color: "#64748B" }}>{t.date}</span>
                    </td>
                    <td>
                      <span
                        className={`pf-pill-status ${t.status === "Résolu" ? "actif" : "en-attente"}`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
