import React from 'react';
import { WalletsView } from '../../components/dashboard/WalletsView';
import { Application, Wallet, LedgerEntry } from '../../types';

interface WalletsPageProps {
  wallets: Wallet[];
  activeApp?: Application;
  ledgerEntries: LedgerEntry[];
  onOpenWithdrawalModal: () => void;
}

export const WalletsPage: React.FC<WalletsPageProps> = ({
  wallets,
  activeApp,
  ledgerEntries,
  onOpenWithdrawalModal,
}) => {
  return (
    <WalletsView
      wallets={wallets}
      activeApp={activeApp}
      ledgerEntries={ledgerEntries}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
