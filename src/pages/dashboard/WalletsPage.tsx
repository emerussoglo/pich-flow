import React from 'react';
import { WalletsView } from '../../components/dashboard/WalletsView';
import { Wallet, LedgerEntry } from '../../types';

interface WalletsPageProps {
  wallets: Wallet[];
  ledgerEntries: LedgerEntry[];
  onOpenWithdrawalModal: () => void;
}

export const WalletsPage: React.FC<WalletsPageProps> = ({
  wallets,
  ledgerEntries,
  onOpenWithdrawalModal,
}) => {
  return (
    <WalletsView
      wallets={wallets}
      ledgerEntries={ledgerEntries}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
