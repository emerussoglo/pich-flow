'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useTransition } from 'react';
import { usePathname, useRouter as useNextRouter } from 'next/navigation';

export interface RouterContextType {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean; scrollToTop?: boolean }) => void;
  // Computed helpers for quick access
  currentRoute:
    | 'landing'
    | 'pricing'
    | 'documentation'
    | 'login'
    | 'register'
    | 'checkout-demo'
    | 'dashboard'
    | 'public-payment-link'
    | 'legal'
    | 'privacy';
  publicPaymentSlug?: string;
  dashboardTab:
    | 'overview'
    | 'wallets'
    | 'transactions'
    | 'payment-links'
    | 'create-payment-link'
    | 'checkout-sessions'
    | 'customers'
    | 'statistics'
    | 'withdrawals'
    | 'developers'
    | 'webhooks'
    | 'webhook-logs'
    | 'disputes'
    | 'pricing'
    | 'support'
    | 'settings'
    | 'apps-selection';
  docsTab: 'quickstart' | 'auth' | 'payments' | 'webhooks' | 'mobile-money' | 'idempotency';
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: ReactNode; initialPathname?: string }> = ({
  children,
  initialPathname,
}) => {
  const nextRouter = useNextRouter();
  const nextPathname = usePathname();
  const [, startTransition] = useTransition();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (initialPathname) return initialPathname;
    if (nextPathname) return nextPathname;
    if (typeof window !== 'undefined') {
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        return window.location.hash.slice(1);
      }
      return window.location.pathname || '/';
    }
    return '/';
  });

  // Keep synced with Next.js pathname when it changes
  useEffect(() => {
    if (nextPathname && nextPathname !== currentPath) {
      setCurrentPath(nextPathname);
    }
  }, [nextPathname]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#/')) {
          setCurrentPath(hash.slice(1));
        } else {
          setCurrentPath(window.location.pathname || '/');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = (to: string, options?: { replace?: boolean; scrollToTop?: boolean }) => {
    let cleanPath = to.startsWith('/') ? to : `/${to}`;

    if (cleanPath === '/landing' || cleanPath === '/home') {
      cleanPath = '/';
    }

    try {
      localStorage.setItem('pichflow_current_path', cleanPath);
    } catch {}

    setCurrentPath(cleanPath);

    startTransition(() => {
      try {
        if (options?.replace) {
          nextRouter.replace(cleanPath);
        } else {
          nextRouter.push(cleanPath);
        }
      } catch {
        if (typeof window !== 'undefined') {
          if (options?.replace) {
            window.history.replaceState(null, '', cleanPath);
          } else {
            window.history.pushState(null, '', cleanPath);
          }
        }
      }
    });

    if (options?.scrollToTop !== false && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Compute current major route
  const pathname = currentPath || '/';
  let currentRoute: RouterContextType['currentRoute'] = 'landing';
  let dashboardTab: RouterContextType['dashboardTab'] = 'overview';
  let docsTab: RouterContextType['docsTab'] = 'quickstart';
  let publicPaymentSlug: string | undefined = undefined;

  if (pathname === '/pricing') {
    currentRoute = 'pricing';
  } else if (pathname === '/login') {
    currentRoute = 'login';
  } else if (pathname === '/register') {
    currentRoute = 'register';
  } else if (pathname === '/mentions-legales' || pathname === '/legal') {
    currentRoute = 'legal';
  } else if (pathname === '/politique-de-confidentialite' || pathname === '/privacy' || pathname === '/confidentialite') {
    currentRoute = 'privacy';
  } else if (pathname.startsWith('/pay/')) {
    currentRoute = 'public-payment-link';
    publicPaymentSlug = pathname.replace(/^\/pay\/?/, '').split('?')[0];
  } else if (pathname === '/checkout-demo' || pathname.startsWith('/checkout')) {
    currentRoute = 'checkout-demo';
  } else if (pathname.startsWith('/documentation') || pathname.startsWith('/docs')) {
    currentRoute = 'documentation';
    const sub = pathname.replace(/^\/(documentation|docs)\/?/, '');
    if (sub === 'auth' || sub === 'api-keys') docsTab = 'auth';
    else if (sub === 'payments') docsTab = 'payments';
    else if (sub === 'webhooks') docsTab = 'webhooks';
    else if (sub === 'mobile-money') docsTab = 'mobile-money';
    else if (sub === 'idempotency') docsTab = 'idempotency';
    else docsTab = 'quickstart';
  } else if (pathname.startsWith('/dashboard')) {
    currentRoute = 'dashboard';
    const sub = pathname.replace(/^\/dashboard\/?/, '');
    if (sub === 'transactions') dashboardTab = 'transactions';
    else if (sub === 'wallets' || sub === 'wallet') dashboardTab = 'wallets';
    else if (sub === 'payment-links' || sub === 'liens-de-paiement') dashboardTab = 'payment-links';
    else if (sub === 'create-payment-link') dashboardTab = 'create-payment-link';
    else if (sub === 'checkout-sessions' || sub === 'sessions-de-checkout') dashboardTab = 'checkout-sessions';
    else if (sub === 'customers' || sub === 'clients') dashboardTab = 'customers';
    else if (sub === 'statistics' || sub === 'statistiques') dashboardTab = 'statistics';
    else if (sub === 'withdrawals' || sub === 'retraits') dashboardTab = 'withdrawals';
    else if (sub === 'developers' || sub === 'developpeur' || sub === 'api-keys') dashboardTab = 'developers';
    else if (sub === 'webhooks') dashboardTab = 'webhooks';
    else if (sub === 'webhook-logs' || sub === 'journal-des-webhooks') dashboardTab = 'webhook-logs';
    else if (sub === 'disputes' || sub === 'litiges') dashboardTab = 'disputes';
    else if (sub === 'pricing' || sub === 'tarification') dashboardTab = 'pricing';
    else if (sub === 'support') dashboardTab = 'support';
    else if (sub === 'settings' || sub === 'parametres' || sub === 'kyc') dashboardTab = 'settings';
    else if (sub === 'apps' || sub === 'apps-selection') dashboardTab = 'apps-selection';
    else dashboardTab = 'overview';
  } else {
    currentRoute = 'landing';
  }

  return (
    <RouterContext.Provider
      value={{
        pathname,
        navigate,
        currentRoute,
        publicPaymentSlug,
        dashboardTab,
        docsTab,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
