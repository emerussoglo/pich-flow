import React from 'react';
import { WebhookLogsView } from '../../components/dashboard/WebhookLogsView';
import { Application } from '../../types';

interface WebhookLogsPageProps {
  activeApp: Application;
}

export const WebhookLogsPage: React.FC<WebhookLogsPageProps> = ({ activeApp }) => {
  return <WebhookLogsView appName={activeApp.name} activeApp={activeApp} />;
};
