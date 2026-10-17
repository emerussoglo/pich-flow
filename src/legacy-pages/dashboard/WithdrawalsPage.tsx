import React from 'react';
import { WithdrawalsView } from '../../components/dashboard/WithdrawalsView';
import { Withdrawal } from '../../types';

interface WithdrawalsPageProps {
  withdrawals: Withdrawal[];
}

export const WithdrawalsPage: React.FC<WithdrawalsPageProps> = ({
  withdrawals,
}) => {
  return (
    <WithdrawalsView
      withdrawals={withdrawals}
    />
  );
};
