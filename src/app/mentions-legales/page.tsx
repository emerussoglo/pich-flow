import type { Metadata } from 'next';
import App from '../../App';

export const metadata: Metadata = {
  title: 'Mentions Légales — PichFlow',
  description: 'Mentions légales et informations éditoriales de la plateforme PichFlow.',
};

export default function MentionsLegalesPage() {
  return <App />;
}

