import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { MultiTenantAuthProvider, useMultiTenantAuth } from "./hooks/useMultiTenantAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { useBranding } from "./hooks/useBranding";
import { useFavicon } from "./hooks/useFavicon";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { AgencyProtectedRoute } from "./components/AgencyProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { AdminPreviewBanner } from "./components/AdminPreviewBanner";
import { ClientPreviewBanner } from "./components/ClientPreviewBanner";
import { AgencyClientPreviewBanner } from "./components/AgencyClientPreviewBanner";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
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

const queryClient = new QueryClient();

const BrandingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { effectiveTheme } = useTheme();
  const { isClientPreviewMode, previewClientAgencyId, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const location = useLocation();
  // Only consider it client view if actually in client preview mode
  const isClientView = isClientPreviewMode;
  // Determine which agency's branding to show:
  // - Client preview mode: show the client's agency branding
  // - Agency preview mode: show the previewed agency's branding
  // - Otherwise: show platform branding (super admin)
  const relevantAgencyId = isClientPreviewMode 
    ? previewClientAgencyId 
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MultiTenantAuthProvider>
          <AuthProvider>
            <ThemeProvider>
              <ClientAgentProvider>
                <BrandingWrapper>
              <Routes>
                {/* Public Routes */}
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Admin Routes (Super Admin) */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/*" element={
                  <AdminProtectedRoute>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <AdminPreviewBanner />
                        <main className="flex-1 p-8 overflow-y-auto">
                          <Routes>
                            <Route path="/" element={<Agencies />} />
                            <Route path="/agencies" element={<Agencies />} />
                            <Route path="/agencies/:id" element={<AgencyDetails />} />
                            <Route path="/billing" element={<AgencyBilling />} />
                            <Route path="/plans" element={<SubscriptionPlans />} />
                            <Route path="/email-templates" element={<EmailTemplates />} />
                            <Route path="/users" element={<SuperAdminUsers />} />
                            <Route path="/settings" element={<AdminSettings />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </AdminProtectedRoute>
                } />

                {/* Agency Routes */}
                <Route path="/agency/login" element={<AgencyLogin />} />
                <Route path="/agency/subscription-required" element={<SubscriptionRequired />} />
                <Route path="/agency/*" element={
                  <AgencyProtectedRoute>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <AdminPreviewBanner />
                        <ClientPreviewBanner />
                        <main className="flex-1 p-8 overflow-y-auto">
                          <Routes>
                            <Route path="/" element={<Navigate to="/agency/clients" replace />} />
                            <Route path="/clients" element={<AgencyClients />} />
                            <Route path="/clients/:clientId/:tab" element={<AgencyClientDetails />} />
                            <Route path="/clients/:clientId" element={<AgencyClientDetails />} />
                            <Route path="/agents" element={<AgencyAgents />} />
                            <Route path="/agents/:agentId" element={<AgencyAgentDetails />} />
                            
                            <Route path="/subscription" element={<AgencySubscription />} />
                            <Route path="/settings" element={<AgencySettings />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </AgencyProtectedRoute>
                } />
                
                {/* Client Auth Route */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Slug-based client login route */}
                <Route path="/:agencySlug" element={<SlugBasedAuth />} />

              {/* Client Routes - Isolated */}
              <Route path="/*" element={
                <ProtectedRoute requireClient>
                  <div className="flex h-screen w-full bg-background overflow-hidden">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <ClientPreviewBanner />
                      <AgencyClientPreviewBanner />
                      <main className="flex-1 p-8 overflow-y-auto">
                        <Routes>
                          <Route path="/" element={<Conversations />} />
                          <Route path="/transcripts" element={<Transcripts />} />
                          <Route path="/text-transcripts" element={<TextTranscripts />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/knowledge-base" element={<KnowledgeBase />} />
                          <Route path="/agent-settings" element={<AgentSettings />} />
                          <Route path="/specs" element={<AgentSpecs />} />
                          <Route path="/guides" element={<Guides />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              </Routes>
                </BrandingWrapper>
              </ClientAgentProvider>
            </ThemeProvider>
          </AuthProvider>
        </MultiTenantAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
