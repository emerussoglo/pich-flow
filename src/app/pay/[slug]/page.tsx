import type { Metadata } from 'next';
import App from '../../../App';

export const metadata: Metadata = {
  title: 'Paiement Sécurisé — PichFlow',
  description: 'Réglez votre facture ou achat en toute sécurité via PichFlow.',
};

export default function PublicPaymentPage() {
  return <App />;
}

