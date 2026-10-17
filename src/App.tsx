'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ToastProvider } from './components/ui/ToastContext';
import { RouterProvider, useRouter } from './lib/router';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

// Landing Page Sections
import { Hero } from './components/landing/Hero';
import { SocialProof } from './components/landing/SocialProof';
import { SelfRecognition } from './components/landing/SelfRecognition';
import { Features } from './components/landing/Features';
import { Developers } from './components/landing/Developers';
import { CheckoutPreview } from './components/landing/CheckoutPreview';
import { PaymentLinksDemo } from './components/landing/PaymentLinksDemo';
import { AfricaCoverage } from './components/landing/AfricaCoverage';
import { HowItWorks, SecuritySection } from './components/landing/HowItWorks';
import { PricingCalculator } from './components/landing/PricingCalculator';
import { FaqAccordion, FinalCta } from './components/landing/FaqAccordion';

// Auth Pages
import { AuthPages } from './components/auth/AuthPages';

// Legal & Privacy Pages
import { LegalMentionsPage } from './legacy-pages/public/LegalMentionsPage';
import { PrivacyPolicyPage } from './legacy-pages/public/PrivacyPolicyPage';

// Documentation Page
import { DocumentationView } from './components/docs/DocumentationView';

// Hosted Checkout Page
import { HostedCheckoutPage } from './components/checkout/HostedCheckoutPage';

// Back to Top button
import { BackToTop } from './components/ui/BackToTop';

// Modular Dashboard Layout & Pages
import { DashboardLayout } from './legacy-pages/dashboard/DashboardLayout';
import { OverviewPage } from './legacy-pages/dashboard/OverviewPage';
import { TransactionsPage } from './legacy-pages/dashboard/TransactionsPage';
import { WalletsPage } from './legacy-pages/dashboard/WalletsPage';
import { PaymentLinksPage } from './legacy-pages/dashboard/PaymentLinksPage';
import { CustomersPage } from './legacy-pages/dashboard/CustomersPage';
import { WithdrawalsPage } from './legacy-pages/dashboard/WithdrawalsPage';
import { DevelopersPage } from './legacy-pages/dashboard/DevelopersPage';
import { SettingsPage } from './legacy-pages/dashboard/SettingsPage';
import { CheckoutSessionsPage } from './legacy-pages/dashboard/CheckoutSessionsPage';
import { StatisticsPage } from './legacy-pages/dashboard/StatisticsPage';
import { WebhooksPage } from './legacy-pages/dashboard/WebhooksPage';
import { WebhookLogsPage } from './legacy-pages/dashboard/WebhookLogsPage';
import { PricingDashboardPage } from './legacy-pages/dashboard/PricingDashboardPage';
import { SupportDashboardPage } from './legacy-pages/dashboard/SupportDashboardPage';
import { AppsSelectionScreen } from './components/dashboard/AppsSelectionScreen';
import { NewAppModal } from './components/dashboard/Modals';

import { Application, Transaction, PaymentLink, Withdrawal, ApiKey, WebhookEndpoint, EnvironmentMode } from './types';
import { useScrollAnimation } from './lib/useScrollAnimation';
import { apiClient, ApiResponseError } from './lib/api';

function AppContent() {
  const { currentRoute, dashboardTab, navigate, publicPaymentSlug } = useRouter();
  useScrollAnimation();

  // Application & State Management (Persisted from real Database)
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [envMode, setEnvMode] = useState<EnvironmentMode>('test');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [sessionRetryCount, setSessionRetryCount] = useState(0);
  const dashboardSessionCheck = useRef<Promise<unknown> | null>(null);
  const lastSessionVerifiedAt = useRef(0);
  const appDataLoadGeneration = useRef(0);
  const hasHandledUnauthorized = useRef(false);
  const [dashboardLoadError, setDashboardLoadError] = useState('');

  const handleUnauthorized = useCallback(() => {
    if (hasHandledUnauthorized.current) return;
    hasHandledUnauthorized.current = true;
    apiClient.clearToken();
    setApplications([]);
    setActiveApp(null);
    setTransactions([]);
    setWallets([]);
    setPaymentLinks([]);
    setWithdrawals([]);
    setApiKeys([]);
    setWebhooks([]);
    try { localStorage.removeItem('pf_active_app_id'); } catch {}
    navigate('/login', { replace: true });
  }, [navigate]);

  // Function to load all isolated data for a specific application
  const loadAppData = useCallback(async (appId?: string) => {
    const generation = ++appDataLoadGeneration.current;
    try {
      const withFallback = <T,>(request: Promise<T>, fallback: T): Promise<T> =>
        request.catch((error: unknown) => {
          if (error instanceof ApiResponseError && error.status === 401) {
            throw error;
          }
          return fallback;
        });

      const [wals, txs, links, wdrs, keys, whs] = await Promise.all([
        withFallback(apiClient.wallets.getAll(appId), []),
        withFallback(apiClient.transactions.getAll(appId), []),
        withFallback(apiClient.paymentLinks.getAll(appId), []),
        withFallback(apiClient.withdrawals.getAll(appId), []),
        withFallback(apiClient.developer.getKeys(appId), []),
        withFallback(apiClient.developer.getWebhooks(appId), []),
      ]);
      if (generation !== appDataLoadGeneration.current) return;
      if (wals) setWallets(wals);
      if (txs) setTransactions(txs);
      if (links) setPaymentLinks(links);
      if (wdrs) setWithdrawals(wdrs);
      if (keys) setApiKeys(keys);
      if (whs) setWebhooks(whs);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        handleUnauthorized();
      } else {
        console.warn('App data sync error:', err);
      }
    }
  }, [handleUnauthorized]);

  // Synchronize applications from server
  const syncApplications = useCallback(async () => {
    const validApps = await apiClient.apps.getAll();
    setApplications(validApps);

    if (validApps.length === 0) {
      setActiveApp(null);
      try { localStorage.removeItem('pf_active_app_id'); } catch {}
    } else {
      const savedAppId = (() => {
        try { return localStorage.getItem('pf_active_app_id'); } catch { return null; }
      })();
      const matchedApp = validApps.find((a) => a.id === savedAppId) || validApps[0];
      await apiClient.apps.selectActive(matchedApp.id);
      setActiveApp(matchedApp);
      try { localStorage.setItem('pf_active_app_id', matchedApp.id); } catch {}
      await loadAppData(matchedApp.id);
    }
  }, [loadAppData]);

  // Validate the session before loading any private dashboard data.
  useEffect(() => {
    if (currentRoute !== 'dashboard') {
      lastSessionVerifiedAt.current = 0;
      hasHandledUnauthorized.current = false;
      setIsDashboardLoading(false);
      setDashboardLoadError('');
      return;
    }

    let active = true;
    if (Date.now() - lastSessionVerifiedAt.current < 5 * 60 * 1000) {
      setIsDashboardLoading(false);
      return () => {
        active = false;
      };
    }

    hasHandledUnauthorized.current = false;
    setDashboardLoadError('');
    setIsDashboardLoading(true);

    const loadDashboard = async () => {
      const sessionCheck = dashboardSessionCheck.current ?? apiClient.auth.me();
      dashboardSessionCheck.current = sessionCheck;
      try {
        await sessionCheck;
        if (!active) return;
        await syncApplications();
        lastSessionVerifiedAt.current = Date.now();
      } catch (error) {
        if (!active) return;

        if (error instanceof ApiResponseError && error.status === 401) {
          handleUnauthorized();
        } else {
          console.error('Dashboard authentication or sync failed:', error);
          setDashboardLoadError('Impossible de vérifier votre session ou de charger vos applications. Vérifiez votre connexion puis actualisez la page.');
        }
      } finally {
        if (dashboardSessionCheck.current === sessionCheck) {
          dashboardSessionCheck.current = null;
        }
        if (active) setIsDashboardLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [currentRoute, handleUnauthorized, syncApplications, sessionRetryCount]);

  // Modals state
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false);
  const [isNewWithdrawalModalOpen, setIsNewWithdrawalModalOpen] = useState(false);
  const [isAppsScreenNewAppOpen, setIsAppsScreenNewAppOpen] = useState(false);

  // Handlers
  const handleSelectApp = async (app: Application) => {
    ++appDataLoadGeneration.current;
    setTransactions([]);
    setPaymentLinks([]);
    setApiKeys([]);
    setWebhooks([]);
    setWallets([]);
    setWithdrawals([]);
    try { localStorage.setItem('pf_active_app_id', app.id); } catch {}
    try {
      await apiClient.apps.selectActive(app.id);
      setActiveApp(app);
      await loadAppData(app.id);
    } catch (error) {
      console.error('Select application error:', error);
      setDashboardLoadError('Impossible de sélectionner cette application. Réessayez.');
    }
  };

  const handleCreateApp = async (newApp: Application) => {
    try {
      const created = await apiClient.apps.create(newApp);
      setApplications((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      await apiClient.apps.selectActive(created.id);
      setActiveApp(created);
      try { localStorage.setItem('pf_active_app_id', created.id); } catch {}
      await loadAppData(created.id);
      navigate('/dashboard/overview');
    } catch (err: any) {
      console.error('Create app error:', err);
    }
  };

  const handleCreatePaymentLink = async (newLink: PaymentLink) => {
    try {
      const created = await apiClient.paymentLinks.create({
        ...newLink,
        applicationId: activeApp?.id,
      });
      setPaymentLinks((prev) => [created, ...prev]);
    } catch (err: any) {
      console.error('Create payment link error:', err);
    }
  };

  const handleCreateWithdrawal = async (newWdr: Withdrawal) => {
    try {
      const created = await apiClient.withdrawals.create(newWdr);
      setWithdrawals((prev) => [created, ...prev]);
      const updatedWallets = await apiClient.wallets.getAll(activeApp?.id).catch(() => null);
      if (updatedWallets) setWallets(updatedWallets);
    } catch (err: any) {
      console.error('Create withdrawal error:', err);
    }
  };

  const handleGenerateApiKey = async (name: string, _env?: 'sandbox' | 'live', scope?: 'payin' | 'payout' | 'both') => {
    try {
      const res = await apiClient.developer.generateKey({
        name,
        scope,
        applicationId: activeApp?.id,
      });
      if (res.keys) {
        setApiKeys((prev) => [res.keys!.live, res.keys!.sandbox, ...prev]);
      } else if (res.apiKey) {
        setApiKeys((prev) => [res.apiKey, ...prev]);
      }
    } catch (err: any) {
      console.error('Error creating API key:', err);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await apiClient.developer.revokeKey(id, activeApp?.id || '');
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    }
  };

  const handleAddWebhook = async (url: string, description: string) => {
    try {
      const created = await apiClient.developer.addWebhook({
        url,
        description,
        applicationId: activeApp?.id,
      });
      setWebhooks((prev) => [created, ...prev]);
    } catch (err: any) {
      console.error('Error adding webhook:', err);
    }
  };

  return (
    <>
      {/* 1. PUBLIC MARKETING WEBSITE */}
      {(currentRoute === 'landing' || currentRoute === 'pricing' || currentRoute === 'documentation') && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar onNavigate={navigate} currentRoute={currentRoute} />

          <main style={{ flex: 1 }}>
            {currentRoute === 'landing' && (
              <>
                <Hero onNavigate={navigate} />
                <SocialProof />
                <SelfRecognition onNavigate={navigate} />
                <Features onNavigate={navigate} />
                <AfricaCoverage />
                <HowItWorks onNavigate={navigate} />
                <SecuritySection />
                <PricingCalculator onNavigate={navigate} />
                <Developers onNavigate={navigate} />
                <FinalCta onNavigate={navigate} />
                <FaqAccordion onNavigate={navigate} />
              </>
            )}

            {currentRoute === 'pricing' && (
              <div style={{ paddingTop: '2rem' }}>
                <PricingCalculator onNavigate={navigate} />
                <FaqAccordion onNavigate={navigate} />
                <FinalCta onNavigate={navigate} />
              </div>
            )}

            {currentRoute === 'documentation' && (
              <DocumentationView />
            )}
          </main>

          <Footer onNavigate={navigate} />
        </div>
      )}

      {/* 2. AUTHENTICATION PAGES */}
      {(currentRoute === 'login' || currentRoute === 'register') && (
        <AuthPages
          onNavigate={navigate}
          initialView={currentRoute as 'login' | 'register'}
        />
      )}

      {/* 2b. LEGAL & PRIVACY PAGES */}
      {currentRoute === 'legal' && (
        <LegalMentionsPage onNavigate={navigate} />
      )}
      {currentRoute === 'privacy' && (
        <PrivacyPolicyPage onNavigate={navigate} />
      )}

      {/* 3. CHECKOUT PREVIEW / PUBLIC PAYMENT LINK */}
      {currentRoute === 'checkout-demo' && (
        <HostedCheckoutPage onBack={() => navigate('/')} />
      )}
      {currentRoute === 'public-payment-link' && (
        <HostedCheckoutPage paymentLinkSlug={publicPaymentSlug} onBack={() => navigate('/')} />
      )}

      {/* 4. MODULAR DASHBOARD APPLICATION (with isolated routes) */}
      {currentRoute === 'dashboard' && (
        isDashboardLoading ? (
          <main role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
            Vérification de la session…
          </main>
        ) : dashboardLoadError ? (
          <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
            <div>
              <p>{dashboardLoadError}</p>
              <button type="button" onClick={() => { lastSessionVerifiedAt.current = 0; setDashboardLoadError(''); setIsDashboardLoading(true); setSessionRetryCount((count) => count + 1); }}>
                Réessayer
              </button>
            </div>
          </main>
        ) : <>
          {dashboardTab === 'apps-selection' ? (
            <>
              <AppsSelectionScreen
                applications={applications}
                onSelectApp={async (app) => {
                  await handleSelectApp(app);
                  navigate('/dashboard/overview');
                }}
                onOpenNewAppModal={() => setIsAppsScreenNewAppOpen(true)}
              />
              <NewAppModal
                isOpen={isAppsScreenNewAppOpen}
                onClose={() => setIsAppsScreenNewAppOpen(false)}
                onCreate={handleCreateApp}
              />
            </>
          ) : (
            <DashboardLayout
              key={activeApp?.id || applications[0]?.id}
              activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
              applications={applications}
              wallets={wallets}
              onSelectApp={handleSelectApp}
              onCreateApp={handleCreateApp}
              envMode={envMode}
              onToggleEnv={setEnvMode}
              onCreatePaymentLink={handleCreatePaymentLink}
              onCreateWithdrawal={handleCreateWithdrawal}
              isNewLinkModalOpen={isNewLinkModalOpen}
              setIsNewLinkModalOpen={setIsNewLinkModalOpen}
              isNewWithdrawalModalOpen={isNewWithdrawalModalOpen}
              setIsNewWithdrawalModalOpen={setIsNewWithdrawalModalOpen}
            >
              {dashboardTab === 'overview' && (
                <OverviewPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                  transactions={transactions}
                  wallets={wallets}
                  onOpenCreateLinkModal={() => setIsNewLinkModalOpen(true)}
                />
              )}

              {dashboardTab === 'transactions' && (
                <TransactionsPage
                  transactions={transactions}
                  activeApp={activeApp || undefined}
                />
              )}

              {dashboardTab === 'wallets' && (
                <WalletsPage
                  wallets={wallets}
                  activeApp={activeApp || undefined}
                  ledgerEntries={[]}
                />
              )}

              {dashboardTab === 'payment-links' && (
                <PaymentLinksPage
                  activeApp={activeApp || undefined}
                  paymentLinks={paymentLinks}
                  onOpenCreateModal={() => setIsNewLinkModalOpen(true)}
                />
              )}

              {dashboardTab === 'create-payment-link' && (
                <PaymentLinksPage
                  activeApp={activeApp || undefined}
                  paymentLinks={paymentLinks}
                  onOpenCreateModal={() => setIsNewLinkModalOpen(true)}
                  initialMode="create"
                />
              )}

              {dashboardTab === 'checkout-sessions' && (
                <CheckoutSessionsPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'customers' && (
                <CustomersPage
                  activeApp={activeApp || undefined}
                />
              )}

              {dashboardTab === 'statistics' && (
                <StatisticsPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'withdrawals' && (
                <WithdrawalsPage
                  withdrawals={withdrawals}
                />
              )}

              {dashboardTab === 'developers' && (
                <DevelopersPage
                  activeApp={activeApp || undefined}
                  apiKeys={apiKeys}
                  webhooks={webhooks}
                  onGenerateKey={handleGenerateApiKey}
                  onRevokeKey={handleRevokeApiKey}
                  onAddWebhook={handleAddWebhook}
                />
              )}

              {dashboardTab === 'webhooks' && (
                <WebhooksPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'webhook-logs' && (
                <WebhookLogsPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'pricing' && (
                <PricingDashboardPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'support' && (
                <SupportDashboardPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                />
              )}

              {dashboardTab === 'settings' && (
                <SettingsPage
                  activeApp={activeApp || applications[0] || { id: 'app_default', name: 'Mon Application', slug: 'mon-application', category: 'E-commerce', environment: 'test', createdAt: new Date().toISOString(), currency: 'XOF' }}
                  onUpdateApp={(updated) => setActiveApp(updated)}
                />
              )}
            </DashboardLayout>
          )}
        </>
      )}

      {/* Floating Back to Top control on public pages */}
      {currentRoute !== 'dashboard' && currentRoute !== 'checkout-demo' && currentRoute !== 'public-payment-link' && (
        <BackToTop />
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </ToastProvider>
  );
}
