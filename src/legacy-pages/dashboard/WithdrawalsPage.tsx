import React from 'react';
import { WithdrawalsView } from '../../components/dashboard/WithdrawalsView';
import { Application, Withdrawal } from '../../types';

interface WithdrawalsPageProps {
  withdrawals: Withdrawal[];
  activeApp?: Application;
}

export const WithdrawalsPage: React.FC<WithdrawalsPageProps> = ({
  withdrawals,
  activeApp,
}) => {
  return (
    <WithdrawalsView
      withdrawals={withdrawals}
      activeApp={activeApp}
      appName={activeApp?.name}
    />
  );
};
