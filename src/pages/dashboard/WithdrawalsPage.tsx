import React from 'react';
import { WithdrawalsView } from '../../components/dashboard/WithdrawalsView';
import { Withdrawal } from '../../types';

interface WithdrawalsPageProps {
  withdrawals: Withdrawal[];
  onOpenWithdrawalModal: () => void;
}

export const WithdrawalsPage: React.FC<WithdrawalsPageProps> = ({
  withdrawals,
  onOpenWithdrawalModal,
}) => {
  return (
    <WithdrawalsView
      withdrawals={withdrawals}
      onOpenWithdrawalModal={onOpenWithdrawalModal}
    />
  );
};
