import React from 'react';

interface DashboardLoadErrorProps {
  message: string;
  onRetry: () => void;
}

export const DashboardLoadError: React.FC<DashboardLoadErrorProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.9rem 1rem',
      marginBottom: '1rem',
      border: '1px solid #FECACA',
      borderRadius: '10px',
      background: '#FEF2F2',
      color: '#991B1B',
    }}
  >
    <span>{message}</span>
    <button type="button" onClick={onRetry} className="pf-btn pf-btn-secondary pf-btn-sm">
      Réessayer
    </button>
  </div>
);
