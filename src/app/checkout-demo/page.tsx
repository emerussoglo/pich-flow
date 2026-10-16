import type { Metadata } from 'next';
import App from '../../App';

export const metadata: Metadata = {
  title: 'Démonstration Checkout — PichFlow',
  description: 'Testez l’expérience de paiement sécurisée PichFlow.',
};

export default function CheckoutDemoPage() {
  return <App />;
}

