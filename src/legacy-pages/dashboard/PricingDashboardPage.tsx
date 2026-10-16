import React from 'react';
import { PricingDashboardView } from '../../components/dashboard/PricingDashboardView';
import { Application } from '../../types';

interface PricingDashboardPageProps {
  activeApp: Application;
}

export const PricingDashboardPage: React.FC<PricingDashboardPageProps> = ({ activeApp }) => {
  return <PricingDashboardView appName={activeApp.name} />;
};
