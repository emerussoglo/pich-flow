import type { Metadata } from 'next';
import App from '../../../App';

export const metadata: Metadata = {
  title: 'Tableau de Bord Marchand — PichFlow',
  description: 'Gérez vos applications, portefeuilles, transactions, clients et clés API sur PichFlow.',
};

export default function DashboardPage() {
  return <App />;
}

