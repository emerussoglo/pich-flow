import React from 'react';
import { WebhooksView } from '../../components/dashboard/WebhooksView';
import { Application } from '../../types';

interface WebhooksPageProps {
  activeApp: Application;
}

export const WebhooksPage: React.FC<WebhooksPageProps> = ({ activeApp }) => {
  return <WebhooksView appName={activeApp.name} activeApp={activeApp} />;
};
