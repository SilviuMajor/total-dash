import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MultiTenantAuthProvider, useMultiTenantAuth } from "./hooks/useMultiTenantAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ImpersonationProvider } from "./hooks/useImpersonation";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { useBranding } from "./hooks/useBranding";
import { useFavicon } from "./hooks/useFavicon";
import { useCustomDomainAgency } from "./hooks/useCustomDomainAgency";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { AgencyProtectedRoute } from "./components/AgencyProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { MobileTopBar } from "./components/MobileTopBar";
import { CommandSearch } from "./components/CommandSearch";
import { DevSwitch } from "./components/DevSwitch";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import AdminLogin from "./pages/admin/AdminLogin";
import AgencyLogin from "./pages/agency/AgencyLogin";
import Agencies from "./pages/admin/Agencies";
import AgencyDetails from "./pages/admin/AgencyDetails";
import AgencyBilling from "./pages/admin/AgencyBilling";
import SubscriptionPlans from "./pages/admin/SubscriptionPlans";
import AdminSettings from "./pages/admin/AdminSettings";
import EmailTemplates from "./pages/admin/EmailTemplates";
import SuperAdminUsers from "./pages/admin/SuperAdminUsers";

import AgencyClients from "./pages/agency/AgencyClients";
import AgencyAgents from "./pages/agency/AgencyAgents";
import AgencySubscription from "./pages/agency/AgencySubscription";
import AgencySettings from "./pages/agency/AgencySettings";
import AgencyClientDetails from "./pages/agency/AgencyClientDetails";
import AgencyAgentDetails from "./pages/agency/AgencyAgentDetails";
import SubscriptionRequired from "./pages/agency/SubscriptionRequired";
import SlugBasedAuth from "./pages/SlugBasedAuth";
import ClientLoginRedirect from "./pages/ClientLoginRedirect";
import Settings from "./pages/Settings";
import Conversations from "./pages/client/Conversations";
import Transcripts from "./pages/client/Transcripts";
import TextTranscripts from "./pages/client/TextTranscripts";
import Analytics from "./pages/client/Analytics";
import KnowledgeBase from "./pages/client/KnowledgeBase";
import AgentSettings from "./pages/client/AgentSettings";
import AgentSpecs from "./pages/client/AgentSpecs";
import Guides from "./pages/client/Guides";
import NotFound from "./pages/NotFound";
import { isMarketingHost } from "./lib/marketing-host";

const MarketingHomePage = lazy(() => import("./pages/marketing/HomePage"));
const MarketingContactPage = lazy(() => import("./pages/marketing/ContactPage"));
const MarketingComingSoonPage = lazy(() => import("./pages/marketing/ComingSoonPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// CustomDomainBootstrap
//
// On a verified whitelabel custom domain (e.g. dashboard.fiveleaf.co.uk):
//   - Stores the agency in sessionStorage.loginAgencyContext so Auth.tsx
//     and SlugBasedAuth pick up agency-branded login automatically.
//   - When an unauthenticated visitor lands on `/`, redirects them to
//     `/login/{slug}` so the branded login is the default landing.
//
// On the platform host (app.total-dash.com, localhost, *.vercel.app) this
// component is a no-op.
//
// "Unknown custom domain" — host isn't on the platform list AND no agency
// claims it — is rendered by AppRoutes via the `isUnknownDomain` flag from
// the hook (see Routes section below).
const CustomDomainBootstrap = () => {
  const { agency, loading, isCustomDomain } = useCustomDomainAgency();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isCustomDomain || loading || !agency) return;
    // Only redirect from bare `/` to keep deep-link / change-password / etc.
    // routes intact. We send to `/login` (slug-less) — on a custom domain
    // the host already identifies the agency, so `/login/fiveleaf` would
    // be redundant in the URL bar. The agency context is already in
    // sessionStorage.loginAgencyContext (populated by useCustomDomainAgency)
    // so Auth.tsx renders branded without needing the slug in the path.
    // Authenticated client users hitting `/` are sent through ProtectedRoute
    // to their dashboard.
    if (location.pathname === '/') {
      navigate('/login', { replace: true });
    }
  }, [agency, loading, isCustomDomain, location.pathname, navigate]);

  return null;
};

// Renders when the browser is on a custom domain that isn't claimed by any
// verified agency — typically a misconfigured DNS pointing at our Vercel
// project, or an agency that was removed without cleaning up DNS.
const UnknownDomainPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-xl font-semibold">This domain isn't configured</h1>
      <p className="text-sm text-muted-foreground">
        The domain <span className="font-mono">{typeof window !== 'undefined' ? window.location.host : ''}</span>{' '}
        points at our service but isn't linked to an active account.
        Contact your provider to finish setup.
      </p>
    </div>
  </div>
);

const BrandingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { effectiveTheme } = useTheme();
  const { isClientPreviewMode, previewClientAgencyId, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const location = useLocation();
  const isClientView = isClientPreviewMode;
  const relevantAgencyId = isClientPreviewMode
    ? (previewClientAgencyId ?? undefined)
    : (isPreviewMode && previewAgency ? previewAgency.id : undefined);
  const branding = useBranding({ 
    isClientView, 
    agencyId: relevantAgencyId,
    appTheme: effectiveTheme
  });
  
  useFavicon(branding.faviconUrl);
  
  useEffect(() => {
    document.title = branding.companyName || 'FiveLeaf';
  }, [branding.companyName]);

  return <>{children}</>;
};

// Top-level body — switches between the unknown-domain page (when on a
// custom domain that no agency owns) and the regular routed app. Lives
// inside MultiTenantAuthProvider so all child contexts work normally.
const AppBody = () => {
  const { isCustomDomain, isUnknownDomain, loading } = useCustomDomainAgency();

  // Block rendering anything custom-domain-related until the lookup resolves
  // (sub-second). Without this we'd briefly flash unbranded content on the
  // custom domain before redirecting to /login/{slug}.
  if (isCustomDomain && loading) {
    return <div className="min-h-screen bg-background" />;
  }
  if (isUnknownDomain) {
    return <UnknownDomainPage />;
  }

  return (
    <BrandingWrapper>
      <CustomDomainBootstrap />
      <CommandSearch />
      <DevSwitch />
      <AppRoutes />
    </BrandingWrapper>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <MultiTenantAuthProvider>
            <ThemeProvider>
              <ImpersonationProvider>
              <ClientAgentProvider>
                <AppBody />
              </ClientAgentProvider>
              </ImpersonationProvider>
            </ThemeProvider>
        </MultiTenantAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const AppRoutes = () => {
  const showMarketing = isMarketingHost();
  return (
              <Routes>
                {/* Marketing Routes (apex + dev hosts only — see lib/marketing-host.ts) */}
                {showMarketing && (
                  <>
                    <Route path="/" element={
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                        <MarketingHomePage />
                      </Suspense>
                    } />
                    <Route path="/contact" element={
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                        <MarketingContactPage />
                      </Suspense>
                    } />
                    <Route path="/signup" element={
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                        <MarketingComingSoonPage />
                      </Suspense>
                    } />
                  </>
                )}

                {/* Public Routes */}
                <Route path="/change-password" element={<ChangePassword />} />
                
                {/* Admin Routes (Super Admin) */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/*" element={
                  <AdminProtectedRoute>
                    <ErrorBoundary>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <MobileTopBar />
                        <main className="flex-1 overflow-y-auto">
                        <Routes>
                            <Route index element={<Agencies />} />
                            <Route path="agencies" element={<Agencies />} />
                            <Route path="agencies/:id" element={<AgencyDetails />} />
                            <Route path="billing" element={<AgencyBilling />} />
                            <Route path="plans" element={<SubscriptionPlans />} />
                            <Route path="email-templates" element={<EmailTemplates />} />
                            <Route path="users" element={<SuperAdminUsers />} />
                            <Route path="settings" element={<AdminSettings />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                    </ErrorBoundary>
                  </AdminProtectedRoute>
                } />

                {/* Agency Routes */}
                <Route path="/agency/login" element={<AgencyLogin />} />
                <Route path="/agency/subscription-required" element={<SubscriptionRequired />} />
                <Route path="/agency/*" element={
                  <AgencyProtectedRoute>
                    <ErrorBoundary>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <MobileTopBar />
                        <main className="flex-1 overflow-y-auto">
                          <Routes>
                            <Route index element={<Navigate to="/agency/clients" replace />} />
                            <Route path="clients" element={<AgencyClients />} />
                            <Route path="clients/:clientId/:tab" element={<AgencyClientDetails />} />
                            <Route path="clients/:clientId" element={<AgencyClientDetails />} />
                            <Route path="agents" element={<AgencyAgents />} />
                            <Route path="agents/:agentId" element={<AgencyAgentDetails />} />
                            
                            <Route path="subscription" element={<AgencySubscription />} />
                            <Route path="settings" element={<AgencySettings />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                    </ErrorBoundary>
                  </AgencyProtectedRoute>
                } />
                
                {/* Client Auth Route */}
                <Route path="/client/login" element={<ClientLoginRedirect />} />

                {/* Slug-based client login route — primary entry on the
                    platform domain (app.total-dash.com/login/{slug}) */}
                <Route path="/login/:agencySlug" element={<SlugBasedAuth />} />

                {/* Slug-less login — used on custom whitelabel domains where
                    the host identifies the agency. Renders Auth using
                    sessionStorage.loginAgencyContext set by
                    useCustomDomainAgency on app boot. */}
                <Route path="/login" element={<Auth />} />

              {/* Client Routes - Isolated */}
              <Route path="/*" element={
                <ProtectedRoute requireClient>
                  <ErrorBoundary>
                  <div className="flex h-screen w-full bg-background overflow-hidden">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <MobileTopBar />
                      <main className="flex-1 overflow-y-auto">
                        <Routes>
                          <Route path="/" element={<ProtectedRoute requiredPage="conversations"><Conversations /></ProtectedRoute>} />
                          <Route path="/transcripts" element={<ProtectedRoute requiredPage="transcripts"><Transcripts /></ProtectedRoute>} />
                          <Route path="/text-transcripts" element={<ProtectedRoute requiredPage="transcripts"><TextTranscripts /></ProtectedRoute>} />
                          <Route path="/analytics" element={<ProtectedRoute requiredPage="analytics"><Analytics /></ProtectedRoute>} />
                          <Route path="/knowledge-base" element={<ProtectedRoute requiredPage="knowledge_base"><KnowledgeBase /></ProtectedRoute>} />
                          <Route path="/agent-settings" element={<ProtectedRoute requiredPage="agent_settings"><AgentSettings /></ProtectedRoute>} />
                          <Route path="/specs" element={<ProtectedRoute requiredPage="specs"><AgentSpecs /></ProtectedRoute>} />
                          <Route path="/guides" element={<ProtectedRoute requiredPage="guides"><Guides /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute requiredPage="settings_page"><Settings /></ProtectedRoute>} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </div>
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              </Routes>
  );
};

export default App;