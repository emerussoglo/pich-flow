import React from 'react';
import { CustomersView } from '../../components/dashboard/CustomersView';
import { Customer, Application } from '../../types';

interface CustomersPageProps {
  customers?: Customer[];
  activeApp?: Application;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ customers, activeApp }) => {
  return <CustomersView customers={customers} activeApp={activeApp} appName={activeApp?.name} />;
};
