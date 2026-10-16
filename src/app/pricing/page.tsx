import type { Metadata } from 'next';
import App from '../../App';

export const metadata: Metadata = {
  title: 'Tarification Transparente — PichFlow',
  description: 'Découvrez nos tarifs clairs et compétitifs pour vos encaissements et retraits en Afrique.',
};

export default function PricingPage() {
  return <App />;
}

