import React from 'react';
import { SettingsView } from '../../components/dashboard/SettingsView';
import { Application } from '../../types';

interface SettingsPageProps {
  activeApp: Application;
  onUpdateApp: (updated: Application) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ activeApp, onUpdateApp }) => {
  return <SettingsView activeApp={activeApp} onUpdateApp={onUpdateApp} />;
};
