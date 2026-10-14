import React from 'react';
import { StatisticsView } from '../../components/dashboard/StatisticsView';
import { Application } from '../../types';

interface StatisticsPageProps {
  activeApp: Application;
}

export const StatisticsPage: React.FC<StatisticsPageProps> = ({ activeApp }) => {
  return <StatisticsView appName={activeApp.name} activeApp={activeApp} />;
};
