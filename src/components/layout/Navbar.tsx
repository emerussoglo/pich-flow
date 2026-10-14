import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faXmark,
  faArrowRight,
  faBook,
  faGauge,
  faSliders,
  faBolt,
  faReceipt,
  faChevronRight,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { PichFlowLogo } from '../ui/PichFlowLogo';

interface NavbarProps {
  onNavigate: (route: string) => void;
  currentRoute: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentRoute }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (route: string, elementId?: string) => {
    setMobileMenuOpen(false);

    if (elementId && route === '/') {
      if (currentRoute !== 'landing') {
        onNavigate('/');
        setTimeout(() => {
          const el = document.getElementById(elementId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else {
        const el = document.getElementById(elementId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    onNavigate(route);
  };

  return (
    <>
      <header className={`pf-navbar ${scrolled ? 'pf-navbar-scrolled' : ''}`}>
        <div className="pf-container pf-navbar-container">
          {/* Logo with Payment Card Emblem */}
          <button
            onClick={() => handleNavClick('/')}
            className="pf-brand"
            aria-label="PichFlow Accueil"
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <PichFlowLogo size="md" />
          </button>

          {/* Desktop Navigation Links matching Capture d'écran 2026-10-09 131829.png */}
          <nav className="pf-nav-links" aria-label="Navigation principale">
            <button
              onClick={() => handleNavClick('/', 'capacites-section')}
              className="pf-nav-link"
            >
              Fonctionalités
            </button>
            
            <button
              onClick={() => handleNavClick('/', 'couverture-section')}
              className="pf-nav-link"
            >
              Pays
            </button>
            <button
              onClick={() => handleNavClick('/pricing')}
              className={`pf-nav-link ${currentRoute === 'pricing' ? 'active' : ''}`}
            >
              Tarifs
            </button>
            <button
              onClick={() => handleNavClick('/documentation')}
              className={`pf-nav-link ${currentRoute === 'documentation' ? 'active' : ''}`}
            >
              Documentation
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="pf-nav-actions">

            <button
              onClick={() => handleNavClick('/login')}
              className="pf-btn pf-btn-ghost pf-nav-login-btn pf-nav-login-desktop"
            >
              Connexion
            </button>

            <button
              onClick={() => handleNavClick('/register')}
              className="pf-btn pf-btn-primary pf-nav-cta-btn pf-btn-shine pf-nav-cta-desktop"
            >
              <span>Commencer</span>
              <FontAwesomeIcon icon={faArrowRight} className="pf-nav-cta-icon" />
            </button>

            

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="pf-nav-toggle"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="pf-mobile-drawer"
            >
              <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Panel */}
      {mobileMenuOpen && (
        <div
          className="pf-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        id="pf-mobile-drawer"
        className={`pf-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
      >
        {/* Drawer Header */}
        <div className="pf-mobile-drawer-header">
          <button
            onClick={() => handleNavClick('/')}
            className="pf-brand"
            aria-label="PichFlow Accueil"
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <PichFlowLogo size="md" />
          </button>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="pf-mobile-close-btn"
            aria-label="Fermer le menu"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>


        {/* Navigation List Simplifiée */}
<nav className="pf-mobile-drawer-nav">
  <button
    onClick={() => handleNavClick('/')}
    className={`pf-mobile-nav-row ${currentRoute === 'landing' ? 'active' : ''}`}
  >
    <span className="pf-mobile-row-title">Produit</span>
    <FontAwesomeIcon icon={faChevronRight} className="pf-mobile-chevron" />
  </button>

  <button
    onClick={() => handleNavClick('/', 'capacites-section')}
    className="pf-mobile-nav-row"
  >
    <span className="pf-mobile-row-title">Capacités de la plateforme</span>
    <FontAwesomeIcon icon={faChevronRight} className="pf-mobile-chevron" />
  </button>

  <button
    onClick={() => handleNavClick('/', 'demarrage-rapide')}
    className="pf-mobile-nav-row"
  >
    <span className="pf-mobile-row-title">Démarrage rapide</span>
    <FontAwesomeIcon icon={faChevronRight} className="pf-mobile-chevron" />
  </button>

  <button
    onClick={() => handleNavClick('/pricing')}
    className={`pf-mobile-nav-row ${currentRoute === 'pricing' ? 'active' : ''}`}
  >
    <span className="pf-mobile-row-title">Tarifs & Simulateur</span>
    <FontAwesomeIcon icon={faChevronRight} className="pf-mobile-chevron" />
  </button>

  <button
    onClick={() => handleNavClick('/documentation')}
    className={`pf-mobile-nav-row ${currentRoute === 'documentation' ? 'active' : ''}`}
  >
    <span className="pf-mobile-row-title">Documentation API</span>
    <FontAwesomeIcon icon={faChevronRight} className="pf-mobile-chevron" />
  </button>
</nav>

        {/* Action Buttons in Drawer */}
        <div className="pf-mobile-drawer-actions">
          <button
            onClick={() => handleNavClick('/login')}
            className="pf-btn pf-btn-secondary pf-btn-lg"
            style={{ width: '100%' }}
          >
            Connexion
          </button>
          <button
            onClick={() => handleNavClick('/register')}
            className="pf-btn pf-btn-primary pf-btn-lg pf-btn-shine"
            style={{ width: '100%' }}
          >
            <span>Créer mon compte</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>

        
      </div>
    </>
  );
};
