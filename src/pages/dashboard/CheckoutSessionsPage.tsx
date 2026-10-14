import React from 'react';
import { CheckoutSessionsView } from '../../components/dashboard/CheckoutSessionsView';
import { Application } from '../../types';

interface CheckoutSessionsPageProps {
  activeApp: Application;
}

export const CheckoutSessionsPage: React.FC<CheckoutSessionsPageProps> = ({ activeApp }) => {
  return <CheckoutSessionsView appName={activeApp.name} activeApp={activeApp} />;
};
