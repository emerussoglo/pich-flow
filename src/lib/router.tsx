import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Normalizes path from hash fallback, browser pathname, or persistent storage
const getInitialPath = (): string => {
  if (typeof window === 'undefined') return '/';

  // 1. Check if there is an explicit hash route like "#/dashboard/transactions"
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const fromHash = window.location.hash.slice(1);
    if (fromHash) return fromHash;
  }

  // 2. Check standard browser pathname
  const path = window.location.pathname;
  if (path && path !== '' && path !== '/') {
    return path;
  }

  // 3. Fallback to localStorage so that hitting F5 in an iframe never resets to landing
  try {
    const saved = localStorage.getItem('pichflow_current_path');
    if (saved && saved !== '/' && saved !== '/landing') {
      return saved;
    }
  } catch (e) {
    // localStorage might be unavailable in some sandboxes
  }

  return '/';
};

export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(getInitialPath);

  useEffect(() => {
    // Sync when user clicks browser Back / Forward or hash changes
    const handleUrlChange = () => {
      setPathname(getInitialPath());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const navigate = (to: string, options?: { replace?: boolean; scrollToTop?: boolean }) => {
    let cleanPath = to.startsWith('/') ? to : `/${to}`;

    // Normalize root
    if (cleanPath === '/landing' || cleanPath === '/home') {
      cleanPath = '/';
    }

    // Persist to localStorage so reloads are guaranteed to restore position
    try {
      localStorage.setItem('pichflow_current_path', cleanPath);
    } catch (e) {
      // ignore
    }

    // Update both history and hash to ensure iframe URL bar & reload capability works
    try {
      if (options?.replace) {
        window.history.replaceState(null, '', cleanPath);
      } else {
        window.history.pushState(null, '', cleanPath);
      }
    } catch (e) {
      // ignore security restrictions if in cross-origin sandbox
    }

    // Also update hash so it's directly visible and bookmarkable even inside AI Studio preview
    if (cleanPath !== '/') {
      window.location.hash = `#${cleanPath}`;
    } else {
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    setPathname(cleanPath);

    if (options?.scrollToTop !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Compute current major route
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
