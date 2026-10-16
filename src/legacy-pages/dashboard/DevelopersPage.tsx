import React from 'react';
import { DeveloperCenterView } from '../../components/dashboard/DeveloperCenterView';
import { ApiKey, Application, WebhookEndpoint } from '../../types';

interface DevelopersPageProps {
  apiKeys?: ApiKey[];
  webhooks?: WebhookEndpoint[];
  activeApp?: Application;
  onGenerateKey?: (name: string, env: 'sandbox' | 'live', scope: 'payin' | 'payout' | 'both') => void;
  onRevokeKey?: (id: string) => void;
  onAddWebhook?: (url: string, description: string) => void;
}

export const DevelopersPage: React.FC<DevelopersPageProps> = ({ activeApp }) => {
  return <DeveloperCenterView appName={activeApp?.name} activeApp={activeApp} />;
};
