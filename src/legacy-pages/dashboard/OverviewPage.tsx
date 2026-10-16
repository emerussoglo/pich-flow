import React from 'react';
import { DashboardOverview } from '../../components/dashboard/DashboardOverview';
import { Application, Transaction, Wallet } from '../../types';
import { useRouter } from '../../lib/router';

interface OverviewPageProps {
  activeApp: Application;
  transactions: Transaction[];
  wallets: Wallet[];
  onOpenCreateLinkModal: () => void;
  onOpenWithdrawalModal: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  activeApp,
  transactions,
  wallets,
  onOpenCreateLinkModal,
  onOpenWithdrawalModal,
}) => {
  const { navigate } = useRouter();

  return (
    <DashboardOverview
      activeApp={activeApp}
      transactions={transactions}
      wallets={wallets}
      onNavigateTab={(tab) => navigate(`/dashboard/${tab}`)}
      onOpenCreateLinkModal={onOpenCreateLinkModal}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
