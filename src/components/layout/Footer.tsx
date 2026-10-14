import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faInstagram,
  faFacebook,
  faTiktok,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import { PichFlowLogo } from '../ui/PichFlowLogo';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (route: string, elementId?: string) => {
    onNavigate(route);
    if (elementId) {
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <footer className="pf-footer-dark">
      <div className="pf-container">
        {/* Grille Principale */}
        <div className="pf-footer-main-grid">
          {/* Info Marque */}
          <div className="pf-footer-brand-info">
            <button
              onClick={() => onNavigate('/')}
              className="pf-brand cursor-pointer"
              aria-label="PichFlow Accueil"
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
            >
              <PichFlowLogo size="md" />
            </button>
            <p className="pf-footer-brand-tagline">
              La couche de paiement moderne pour l'Afrique : Mobile Money et cartes bancaires.
            </p>
          </div>

          {/* Nav Links Wrapper (Grille compacte sur mobile) */}
          <div className="pf-footer-nav-wrapper">
            {/* Colonne Produit */}
            <div className="pf-footer-nav-col">
              <h4 className="pf-footer-nav-title">Produit</h4>
              <ul className="pf-footer-nav-list">
                <li><button onClick={() => handleNav('/')}>Solutions</button></li>
                <li><button onClick={() => handleNav('/', 'capacites-section')}>Plateforme</button></li>
                <li><button onClick={() => handleNav('/', 'couverture-section')}>Pays couverts</button></li>
                <li><button onClick={() => handleNav('/pricing')}>Tarifs</button></li>
              </ul>
            </div>

            {/* Colonne Ressources */}
            <div className="pf-footer-nav-col">
              <h4 className="pf-footer-nav-title">Ressources</h4>
              <ul className="pf-footer-nav-list">
                <li><button onClick={() => handleNav('/documentation')}>Documentation</button></li>
                <li><button onClick={() => handleNav('/documentation/payments')}>API</button></li>
                <li><button onClick={() => handleNav('/dashboard')}>Statut</button></li>
                <li><button onClick={() => handleNav('/', 'securite-section')}>Sécurité</button></li>
              </ul>
            </div>

            {/* Colonne Entreprise */}
            <div className="pf-footer-nav-col">
              <h4 className="pf-footer-nav-title">Entreprise</h4>
              <ul className="pf-footer-nav-list">
                <li><button onClick={() => handleNav('/')}>À propos</button></li>
                <li><a href="mailto:support@pichflow.com">Contact</a></li>
                <li><button onClick={() => handleNav('/mentions-legales')}>Mentions légales</button></li>
                <li><button onClick={() => handleNav('/politique-de-confidentialite')}>Confidentialité</button></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Barre du bas (Copyright + Réseaux) */}
        <div className="pf-footer-sub-bar">
          <div className="pf-sub-bar-copy">
            © {new Date().getFullYear()} PichFlow. Tous droits réservés.
          </div>

        {/* Réseaux Sociaux : ICONES UNIQUEMENT */}
<div className="pf-sub-bar-socials" aria-label="Réseaux sociaux">
  <a
    href="https://instagram.com"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Instagram"
    title="Instagram"
  >
    <FontAwesomeIcon icon={faInstagram} />
  </a>
  <a
    href="https://www.facebook.com/PichFlow"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Facebook"
    title="Facebook"
  >
    <FontAwesomeIcon icon={faFacebook} />
  </a>
  <a
    href="https://www.tiktok.com/@pichflow"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="TikTok"
    title="TikTok"
  >
    <FontAwesomeIcon icon={faTiktok} />
  </a>
  <a
    href="https://youtube.com/@pichflow"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="YouTube"
    title="YouTube"
  >
    <FontAwesomeIcon icon={faYoutube} />
  </a>
</div>
        </div>

        {/* Grand Watermark du fond (Style Image de référence) */}
        <div className="pf-footer-watermark" aria-hidden="true">
          PICHFLOW
        </div>
      </div>
    </footer>
  );
};