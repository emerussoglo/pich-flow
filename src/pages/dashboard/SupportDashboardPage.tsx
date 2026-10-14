import React from 'react';
import { SupportDashboardView } from '../../components/dashboard/SupportDashboardView';
import { Application } from '../../types';

interface SupportDashboardPageProps {
  activeApp: Application;
}

export const SupportDashboardPage: React.FC<SupportDashboardPageProps> = ({ activeApp }) => {
  return <SupportDashboardView appName={activeApp.name} />;
};
