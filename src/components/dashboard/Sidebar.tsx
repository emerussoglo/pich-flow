import React, { useState } from 'react';
import { Application } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faWallet,
  faListUl,
  faArrowUpRightFromSquare,
  faLink,
  faUsers,
  faChartLine,
  faCircleArrowDown,
  faCode,
  faCircleNodes,
  faClock,
  faLock,
  faCreditCard,
  faCircleQuestion,
  faGear,
  faChevronDown,
  faPlus,
  faXmark,
  faRightFromBracket,
  faCheck,
  faBars,
  faAnglesLeft,
  faAnglesRight,
} from '@fortawesome/free-solid-svg-icons';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  applications: Application[];
  activeApp?: Application | null;
  onSelectApp: (app: Application) => void;
  onOpenNewAppModal: () => void;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  applications,
  activeApp,
  onSelectApp,
  onOpenNewAppModal,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Accueil', icon: faHouse },
    { id: 'wallets', label: 'Portefeuille', icon: faWallet },
    { id: 'transactions', label: 'Historique', icon: faListUl },
    { id: 'payment-links', label: 'Liens de paiement', icon: faArrowUpRightFromSquare },
    { id: 'checkout-sessions', label: 'Checkouts', icon: faLink },
    { id: 'customers', label: 'Clients', icon: faUsers },
    { id: 'statistics', label: 'Stats', icon: faChartLine },
    { id: 'withdrawals', label: 'Retraits', icon: faCircleArrowDown },
    { id: 'developers', label: 'Clés API', icon: faCode },
    { id: 'webhooks', label: 'Webhooks', icon: faCircleNodes },
    { id: 'webhook-logs', label: 'Historique des requêtes', icon: faClock },
    { id: 'pricing', label: 'Tarifs', icon: faCreditCard },
    { id: 'support', label: 'Aide', icon: faCircleQuestion },
    { id: 'settings', label: 'Réglages', icon: faGear },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  const appInitial = (activeApp?.name || 'P').charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="pf-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`pf-saspay-sidebar ${isOpenMobile ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Desktop Header with Collapse Button */}
        
        {/* Mobile Header: MENU + Close X button */}
        <div className="pf-sidebar-mobile-head">
          <span className="pf-sidebar-menu-title">MENU</span>
          <button
            onClick={onCloseMobile}
            className="pf-sidebar-mobile-close-btn"
            aria-label="Fermer le menu"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Top App Selector Card (Exact screenshot style) */}
        <div className="pf-sidebar-app-box">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setAppDropdownOpen(!appDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="pf-app-card-btn"
              aria-expanded={appDropdownOpen}
              title={activeApp ? `${activeApp.name} (${activeApp.category})` : 'Sélectionner une application'}
            >
              <div className="pf-app-card-left">
                <div className="pf-app-card-avatar">
                  {appInitial}
                </div>
                <div className="pf-app-card-info">
                  <div className="pf-app-card-name">{activeApp?.name || 'Aucune application'}</div>
                  <div className="pf-app-card-category">{activeApp?.category || 'Créer une app'}</div>
                </div>
              </div>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`pf-app-card-chevron ${appDropdownOpen ? 'rotated' : ''}`}
              />
            </button>

            {/* Application Dropdown Menu */}
            {appDropdownOpen && (
              <div className="pf-app-popup-menu">
                <div className="pf-app-popup-header">Vos applications</div>
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => {
                      onSelectApp(app);
                      setAppDropdownOpen(false);
                    }}
                    className={`pf-app-popup-row ${app.id === activeApp?.id ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div className="pf-app-card-avatar sm">
                        {app.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>
                          {app.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
                          {app.category}
                        </div>
                      </div>
                    </div>
                    {app.id === activeApp?.id && (
                      <span className="pf-app-popup-dot" />
                    )}
                  </div>
                ))}

                <div className="pf-app-popup-divider" />

                <div
                  onClick={() => {
                    setAppDropdownOpen(false);
                    onOpenNewAppModal();
                  }}
                  className="pf-app-popup-row action"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div className="pf-app-popup-add-icon">
                      <FontAwesomeIcon icon={faPlus} />
                    </div>
                    <span style={{ fontWeight: 600, color: '#2563EB', fontSize: '0.8125rem' }}>
                      Créer une nouvelle application
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setAppDropdownOpen(false);
                    handleNavClick('apps-selection');
                  }}
                  className="pf-app-popup-row"
                  style={{ borderTop: '1px solid #F1F5F9' }}
                >
                  <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>
                    Voir toutes les applications
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation items list (Scrollable, exact 15 items from screenshots) */}
        <nav className="pf-sidebar-nav-scroll">
          {navItems.map((item) => {
            const isActive = currentTab === item.id || (item.id === 'overview' && currentTab === '');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`pf-saspay-nav-link ${isActive ? 'active' : ''}`}
                title={item.label}
                aria-label={item.label}
              >
                <span className="pf-nav-icon">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <span className="pf-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile Card (Exact screenshot style) */}
        <div className="pf-sidebar-user-box">
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setAppDropdownOpen(false);
              }}
              className="pf-user-card-btn"
              aria-expanded={userDropdownOpen}
              title="SOGLO Julsido Emérus — emerussoglo@gmail.com"
            >
              <div className="pf-user-avatar-circle">SJ</div>
              <div className="pf-user-card-info">
                <div className="pf-user-card-name">SOGLO Julsido Emérus</div>
                <div className="pf-user-card-app">{activeApp?.name || 'Mon Application'}</div>
              </div>
            </button>

            {/* Bottom User Popover Dropdown (Screenshot 7) */}
            {userDropdownOpen && (
              <div className="pf-user-popup-menu">
                <div className="pf-user-popup-head">
                  <div className="pf-user-avatar-circle md">SJ</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pf-user-popup-name">SOGLO Julsido Em...</div>
                    <div className="pf-user-popup-email">emerussoglo@gmail.com</div>
                  </div>
                </div>

                <div className="pf-app-popup-divider" />

                <div
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleNavClick('apps-selection');
                  }}
                  className="pf-user-popup-row"
                >
                  <FontAwesomeIcon icon={faHouse} />
                  <span>Changer d'application</span>
                </div>

                <div
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleNavClick('settings');
                  }}
                  className="pf-user-popup-row"
                >
                  <FontAwesomeIcon icon={faGear} />
                  <span>Paramètres</span>
                </div>

                <div
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleNavClick('support');
                  }}
                  className="pf-user-popup-row"
                >
                  <FontAwesomeIcon icon={faCircleQuestion} />
                  <span>Support</span>
                </div>

                <div className="pf-app-popup-divider" />

                <div
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="pf-user-popup-row danger"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                  <span>Déconnexion</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
