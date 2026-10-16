import React from 'react';
import { TransactionsView } from '../../components/dashboard/TransactionsView';
import { Transaction, Application } from '../../types';

interface TransactionsPageProps {
  transactions?: Transaction[];
  activeApp?: Application;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ transactions, activeApp }) => {
  return <TransactionsView transactions={transactions} activeApp={activeApp} appName={activeApp?.name} />;
};
