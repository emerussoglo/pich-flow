import React from 'react';
import { WalletsView } from '../../components/dashboard/WalletsView';
import { Application, Wallet, LedgerEntry } from '../../types';

interface WalletsPageProps {
  wallets: Wallet[];
  ledgerEntries: LedgerEntry[];
  activeApp?: Application;
  onOpenWithdrawalModal: () => void;
}

export const WalletsPage: React.FC<WalletsPageProps> = ({
  wallets,
  ledgerEntries,
  activeApp,
  onOpenWithdrawalModal,
}) => {
  return (
    <WalletsView
      appName={activeApp?.name}
      wallets={wallets}
      ledgerEntries={ledgerEntries}
      activeApp={activeApp}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
