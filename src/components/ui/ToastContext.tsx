import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleExclamation,
  faCircleInfo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recentToastTimes = useRef(new Map<string, number>());

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const key = `${type}:${message}`;
    const now = Date.now();
    const previousTime = recentToastTimes.current.get(key);
    if (previousTime && now - previousTime < 2500) return;
    recentToastTimes.current.set(key, now);

    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (recentToastTimes.current.get(key) === now) recentToastTimes.current.delete(key);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pf-toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="pf-toast">
            {toast.type === 'success' && (
              <FontAwesomeIcon icon={faCheckCircle} className="pf-toast-icon-success" />
            )}
            {toast.type === 'error' && (
              <FontAwesomeIcon icon={faCircleExclamation} className="pf-toast-icon-danger" />
            )}
            {toast.type === 'info' && (
              <FontAwesomeIcon icon={faCircleInfo} className="pf-toast-icon-info" />
            )}
            {toast.type === 'warning' && (
              <FontAwesomeIcon icon={faCircleExclamation} className="pf-toast-icon-warning" />
            )}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ color: 'var(--pf-muted)', padding: '0.2rem' }}
              aria-label="Fermer la notification"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
