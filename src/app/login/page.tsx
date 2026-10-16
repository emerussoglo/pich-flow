import type { Metadata } from 'next';
import App from '../../App';

export const metadata: Metadata = {
  title: 'Connexion Marchand — PichFlow',
  description: 'Connectez-vous à votre espace marchand PichFlow pour gérer vos encaissements et retraits.',
};

export default function LoginPage() {
  return <App />;
}

