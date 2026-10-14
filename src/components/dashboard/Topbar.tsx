import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faSearch,
  faBell,
  faChevronDown,
  faGear,
  faCircleQuestion,
  faRightFromBracket,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from '../../lib/router';
import { Application } from '../../types';

interface TopbarProps {
  onOpenMobileSidebar: () => void;
  onLogout?: () => void;
  activeApp?: Application;
  onOpenNewPaymentLinkModal?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileSidebar,
  onLogout,
}) => {
  const { navigate } = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogout = () => {
    if (onLogout) onLogout();
    else navigate('/');
  };

  return (
    <header className="pf-saspay-topbar">
      <div className="pf-topbar-left-zone">
        {/* Mobile menu toggle */}
        <button
          onClick={onOpenMobileSidebar}
          className="pf-topbar-hamburger-btn"
          aria-label="Ouvrir le menu"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>

        {/* Search input (Exact placeholder from screenshots: Recherche (bientôt)) */}
        
      </div>

      <div className="pf-topbar-right-zone">
        {/* Notification Bell Icon */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserDropdownOpen(false);
            }}
            className="pf-topbar-bell-btn"
            aria-label="Notifications"
          >
            <FontAwesomeIcon icon={faBell} />
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="pf-topbar-notif-menu">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #F1F5F9' }}>
                <strong style={{ fontSize: '0.8125rem', color: '#1E293B' }}>Notifications</strong>
                <span style={{ fontSize: '0.75rem', color: '#2563EB', cursor: 'pointer', fontWeight: 600 }}>Tout marquer comme lu</span>
              </div>
              <div style={{ padding: '0.5rem' }}>
                <div style={{ padding: '0.65rem', borderRadius: '8px', background: '#F8FAFC', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>Paiement reçu : 1 000 XOF</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>MTN MoMo Bénin · Il y a 2h</div>
                </div>
                <div style={{ padding: '0.65rem', borderRadius: '8px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>Webhook délivré</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>Code HTTP 200 OK · Il y a 5h</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Pill Button (Exact Screenshot 7) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setUserDropdownOpen(!userDropdownOpen);
              setNotificationsOpen(false);
            }}
            className="pf-topbar-user-btn"
            aria-expanded={userDropdownOpen}
          >
            <div className="pf-user-avatar-circle sm">SJ</div>
            <span className="pf-topbar-user-text">SOGLO Julsido Emérus</span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`pf-topbar-chevron ${userDropdownOpen ? 'rotated' : ''}`}
            />
          </button>

          {/* User Popover Dropdown (Exact Screenshot 7) */}
          {userDropdownOpen && (
            <div className="pf-topbar-user-popover">
              <div className="pf-user-popover-header">
                <div className="pf-user-avatar-circle md">SJ</div>
                <div style={{ minWidth: 0 }}>
                  <div className="pf-user-popover-name">SOGLO Julsido Em...</div>
                  <div className="pf-user-popover-email">emerussoglo@gmail.com</div>
                </div>
              </div>

              <div className="pf-app-popup-divider" />

              <div
                onClick={() => {
                  setUserDropdownOpen(false);
                  navigate('/dashboard/apps');
                }}
                className="pf-user-popover-row"
              >
                <FontAwesomeIcon icon={faBars} />
                <span>Mes applications</span>
              </div>

              <div
                onClick={() => {
                  setUserDropdownOpen(false);
                  navigate('/dashboard/settings');
                }}
                className="pf-user-popover-row"
              >
                <FontAwesomeIcon icon={faGear} />
                <span>Paramètres</span>
              </div>

              <div
                onClick={() => {
                  setUserDropdownOpen(false);
                  navigate('/dashboard/support');
                }}
                className="pf-user-popover-row"
              >
                <FontAwesomeIcon icon={faCircleQuestion} />
                <span>Support</span>
              </div>

              <div className="pf-app-popup-divider" />

              <div
                onClick={() => {
                  setUserDropdownOpen(false);
                  handleLogout();
                }}
                className="pf-user-popover-row danger"
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
                <span>Déconnexion</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
