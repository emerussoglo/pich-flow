import React, { useState, ReactNode } from 'react';
import { Sidebar } from '../../components/dashboard/Sidebar';
import { Topbar } from '../../components/dashboard/Topbar';
import {
  NewAppModal,
  NewPaymentLinkModal,
  NewWithdrawalModal,
} from '../../components/dashboard/Modals';
import { Application, EnvironmentMode, PaymentLink, Withdrawal } from '../../types';
import { useRouter } from '../../lib/router';
import { apiClient } from '../../lib/api';

interface DashboardLayoutProps {
  children: ReactNode;
  activeApp: Application;
  applications: Application[];
  wallets: any[];
  onSelectApp: (app: Application) => void;
  onCreateApp: (app: Application) => void;
  envMode: EnvironmentMode;
  onToggleEnv: (mode: EnvironmentMode) => void;
  onCreatePaymentLink: (link: PaymentLink) => void;
  onCreateWithdrawal: (wdr: Withdrawal) => void;
  isNewLinkModalOpen: boolean;
  setIsNewLinkModalOpen: (open: boolean) => void;
  isNewWithdrawalModalOpen: boolean;
  setIsNewWithdrawalModalOpen: (open: boolean) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeApp,
  applications,
  wallets,
  onSelectApp,
  onCreateApp,
  envMode,
  onToggleEnv,
  onCreatePaymentLink,
  onCreateWithdrawal,
  isNewLinkModalOpen,
  setIsNewLinkModalOpen,
  isNewWithdrawalModalOpen,
  setIsNewWithdrawalModalOpen,
}) => {
  const { dashboardTab, navigate } = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isNewAppModalOpen, setIsNewAppModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pf_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pf_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleSelectTab = (tab: string) => {
    if (tab === 'doc-redirect') {
      navigate('/documentation');
      return;
    }
    if (tab === 'home-redirect') {
      navigate('/');
      return;
    }
    navigate(`/dashboard/${tab}`);
  };

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
    } catch (error) {
      console.warn('[Auth] Server-side logout failed:', error);
      apiClient.clearToken();
    } finally {
      try {
        localStorage.removeItem('pf_active_app_id');
      } catch {}
      navigate('/login');
    }
  };

  return (
    <div className="pf-dashboard-layout">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentTab={dashboardTab}
        onSelectTab={handleSelectTab}
        applications={applications}
        activeApp={activeApp}
        onSelectApp={onSelectApp}
        onOpenNewAppModal={() => setIsNewAppModalOpen(true)}
        onLogout={handleLogout}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div className={`pf-dashboard-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Topbar
          activeApp={activeApp}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNewPaymentLinkModal={() => setIsNewLinkModalOpen(true)}
        />

        {/* Route-Specific Subpage Content */}
        <div className="pf-dashboard-content-wrapper">
          {children}
        </div>
      </div>

      {/* Modals */}
      <NewAppModal
        isOpen={isNewAppModalOpen}
        onClose={() => setIsNewAppModalOpen(false)}
        onCreate={onCreateApp}
      />

      <NewPaymentLinkModal
        isOpen={isNewLinkModalOpen}
        onClose={() => setIsNewLinkModalOpen(false)}
        onCreate={onCreatePaymentLink}
      />

      <NewWithdrawalModal
        isOpen={isNewWithdrawalModalOpen}
        onClose={() => setIsNewWithdrawalModalOpen(false)}
        onCreate={onCreateWithdrawal}
        wallets={wallets}
      />
    </div>
  );
};
