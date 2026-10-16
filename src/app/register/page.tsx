import type { Metadata } from 'next';
import App from '../../App';

export const metadata: Metadata = {
  title: 'Créer un Compte — PichFlow',
  description: 'Créez votre compte marchand PichFlow et commencez à encaisser vos paiements Mobile Money.',
};

export default function RegisterPage() {
  return <App />;
}

