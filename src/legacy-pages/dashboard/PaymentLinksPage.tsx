import React from 'react';
import { PaymentLinksView } from '../../components/dashboard/PaymentLinksView';
import { PaymentLink, Application } from '../../types';

interface PaymentLinksPageProps {
  paymentLinks?: PaymentLink[];
  activeApp?: Application;
  onOpenCreateModal: () => void;
  initialMode?: 'list' | 'create';
}

export const PaymentLinksPage: React.FC<PaymentLinksPageProps> = ({
  paymentLinks,
  activeApp,
  onOpenCreateModal,
  initialMode = 'list',
}) => {
  return (
    <PaymentLinksView
      paymentLinks={paymentLinks}
      activeApp={activeApp}
      appName={activeApp?.name}
      onOpenCreateModal={onOpenCreateModal}
      initialMode={initialMode}
    />
  );
};
