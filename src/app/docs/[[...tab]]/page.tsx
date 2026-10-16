import type { Metadata } from 'next';
import App from '../../../App';

export const metadata: Metadata = {
  title: 'Documentation Développeur — PichFlow',
  description: 'Guides d’intégration, spécification API et SDKs pour intégrer PichFlow dans votre projet.',
};

export default function DocsAliasPage() {
  return <App />;
}

