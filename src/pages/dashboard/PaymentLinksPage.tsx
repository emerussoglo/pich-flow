import React from 'react';
import { PaymentLinksView } from '../../components/dashboard/PaymentLinksView';
import { PaymentLink, Application } from '../../types';
import { useRouter } from '../../lib/router';

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
  const { navigate } = useRouter();

  const handlePreviewLink = (_link: PaymentLink) => {
    navigate('/checkout-demo');
  };

  return (
    <PaymentLinksView
      paymentLinks={paymentLinks}
      activeApp={activeApp}
      appName={activeApp?.name}
      onOpenCreateModal={onOpenCreateModal}
      onPreviewLink={handlePreviewLink}
      initialMode={initialMode}
    />
  );
};
