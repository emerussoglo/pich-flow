import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingColumns,
  faEnvelope,
  faShieldHalved,
  faServer,
  faScaleBalanced,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { PichFlowLogo } from "../../components/ui/PichFlowLogo";

interface LegalMentionsPageProps {
  onNavigate: (route: string) => void;
}

export const LegalMentionsPage: React.FC<LegalMentionsPageProps> = ({
  onNavigate,
}) => {
  return (
    <div
      style={{
        background: "#F8FAFC",
        minHeight: "100vh",
        color: "#0F172A",
        paddingBottom: "4rem",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "1.25rem 1.5rem",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: "1024px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => onNavigate("/")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            aria-label="PichFlow Accueil"
          >
            <PichFlowLogo size="md" />
          </button>
          <button
            onClick={() => onNavigate("/")}
            className="pf-btn pf-btn-secondary pf-btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Retour à l'accueil</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: "860px",
          margin: "3rem auto 0 auto",
          padding: "0 1.5rem",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "1rem",
            border: "1px solid #E2E8F0",
            padding: "2.5rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              color: "#2563EB",
              marginBottom: "0.75rem",
            }}
          >
            <FontAwesomeIcon
              icon={faScaleBalanced}
              style={{ fontSize: "1.25rem" }}
            />
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Informations Réglementaires
            </span>
          </div>

          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: "1rem",
              lineHeight: 1.25,
            }}
          >
            Mentions Légales
          </h1>
          <p
            style={{
              color: "#64748B",
              fontSize: "0.9375rem",
              marginBottom: "2.5rem",
              lineHeight: 1.6,
            }}
          >
            Dernière mise à jour : 12 octobre 2026. Conformément aux
            dispositions légales relatives à la confiance dans l'économie
            numérique et aux services de paiement en ligne.
          </p>

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #F1F5F9",
              marginBottom: "2rem",
            }}
          />

          {/* Section 1 : Éditeur */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
              }}
            >
              <FontAwesomeIcon
                icon={faBuildingColumns}
                style={{ color: "#2563EB" }}
              />
              1. Éditeur de la Plateforme
            </h2>
            <div
              style={{
                background: "#F8FAFC",
                padding: "1.25rem",
                borderRadius: "0.75rem",
                border: "1px solid #E2E8F0",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
                color: "#334155",
              }}
            >
              <p>
                <strong>Dénomination commerciale :</strong> PichFlow
              </p>
              <p>
                <strong>Nature du service :</strong> Passerelle d'orchestration
                technique et infrastructure d'encaissement digital multi-réseaux
                (Mobile Money et cartes bancaires).
              </p>
              <p>
                <strong>Contact e-mail :</strong> contact@pichflow.com
              </p>
              <p>
                <strong>Support technique :</strong> contactpichflow@gmail.com
              </p>
              <p>
                <strong>Pays de gouvernance :</strong> République du Bénin
                (UEMOA / CEDEAO) & couverture sous-régionale Afrique de l'Ouest
                et Centrale.
              </p>
            </div>
          </section>

          {/* Section 2 : Hébergement */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
              }}
            >
              <FontAwesomeIcon icon={faServer} style={{ color: "#2563EB" }} />
              2. Hébergement et Infrastructure Cloud
            </h2>
            <div
              style={{
                color: "#475569",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
              }}
            >
              <p style={{ marginBottom: "0.75rem" }}>
                L'infrastructure technique, les bases de données chiffrées et
                les microservices de PichFlow sont hébergés au sein
                d'environnements Cloud conformes aux plus hauts standards de
                haute disponibilité et de redondance :
              </p>
              <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
                <li>
                  <strong>Hébergement applicatif :</strong> Google Cloud
                  Platform (GCP) — Région Europe (West) & passerelles edge
                  mondiales certifiées ISO 27001, SOC 2 Type II et PCI-DSS
                  niveau 1.
                </li>
                <li>
                  <strong>Base de données répliquée :</strong> Turso libSQL
                  Cloud haute performance avec chiffrement AES-256 au repos et
                  TLS 1.3 en transit.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 : Prestataires de paiement */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
              }}
            >
              <FontAwesomeIcon
                icon={faShieldHalved}
                style={{ color: "#2563EB" }}
              />
              3. Prestataires de Services de Paiement (PSP) & Conformité
            </h2>
            <div
              style={{
                color: "#475569",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
              }}
            >
              <p style={{ marginBottom: "0.75rem" }}>
                PichFlow agit en qualité d'opérateur d'infrastructure
                technologique et de passerelle de connectivité logicielle. Les
                opérations monétaires, l'encaissement des fonds et les
                reversements bancaires sont traités en partenariat avec des
                institutions et prestataires agréés par la Banque Centrale des
                États de l'Afrique de l'Ouest (BCEAO) et la BEAC :
              </p>
              <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
                <li>
                  <strong>Partenaire agréé :</strong> PayDunya SARL (agrément
                  établissement de paiement sous-régional).
                </li>
                <li>
                  <strong>Opérateurs télécoms partenaires :</strong> MTN MoMo,
                  Orange Money, Moov Money, Wave Mobile Money, Free Money.
                </li>
                <li>
                  <strong>Réseaux cartes :</strong> Visa et Mastercard avec
                  authentification 3D Secure 2.0 obligatoire.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 : Propriété intellectuelle */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "1rem",
              }}
            >
              4. Propriété Intellectuelle
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
              }}
            >
              L'ensemble des éléments graphiques, marques, logos, codes sources,
              documentations d'API, bibliothèques logicielles et interfaces
              constitutifs de la plateforme PichFlow demeurent la propriété
              exclusive de leurs ayants droit respectifs. Toute reproduction
              intégrale ou partielle non autorisée est strictement interdite.
            </p>
          </section>

          {/* Section 5 : Contact */}
          <section>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
              }}
            >
              <FontAwesomeIcon icon={faEnvelope} style={{ color: "#2563EB" }} />
              5. Contact et Réclamations
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
              }}
            >
              Pour toute question d'ordre légal, signalement de vulnérabilité ou
              assistance commerciale, notre équipe est joignable à l'adresse
              suivante :{" "}
              <a
                href="mailto:contactpichflow@gmail.com"
                style={{ color: "#2563EB", fontWeight: 600 }}
              >
                contactpichflow@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};
