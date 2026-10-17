import React from 'react';
import { WithdrawalsView } from '../../components/dashboard/WithdrawalsView';
import { Application, Withdrawal } from '../../types';

interface WithdrawalsPageProps {
  withdrawals: Withdrawal[];
  activeApp?: Application;
  onOpenWithdrawalModal: () => void;
}

export const WithdrawalsPage: React.FC<WithdrawalsPageProps> = ({
  withdrawals,
  activeApp,
  onOpenWithdrawalModal,
}) => {
  return (
    <WithdrawalsView
      appName={activeApp?.name}
      activeApp={activeApp}
      withdrawals={withdrawals}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
