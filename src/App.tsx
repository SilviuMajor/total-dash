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

import AgencyClients from "./pages/agency/AgencyClients";
import AgencyAgents from "./pages/agency/AgencyAgents";
import AgencySubscription from "./pages/agency/AgencySubscription";
import AgencySettings from "./pages/agency/AgencySettings";
import AgencyClientDetails from "./pages/agency/AgencyClientDetails";
import AgencyAgentDetails from "./pages/agency/AgencyAgentDetails";
import SubscriptionRequired from "./pages/agency/SubscriptionRequired";
import Settings from "./pages/Settings";
import Conversations from "./pages/client/Conversations";
import Transcripts from "./pages/client/Transcripts";
import Analytics from "./pages/client/Analytics";
import KnowledgeBase from "./pages/client/KnowledgeBase";
import AgentSettings from "./pages/client/AgentSettings";
import AgentSpecs from "./pages/client/AgentSpecs";
import Guides from "./pages/client/Guides";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const BrandingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { effectiveTheme } = useTheme();
  const { isClientPreviewMode, previewClientAgencyId } = useMultiTenantAuth();
  const location = useLocation();
  const isClientView = isClientPreviewMode || location.pathname.startsWith('/');
  const branding = useBranding({ 
    isClientView, 
    agencyId: previewClientAgencyId,
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
                          <Route path="/" element={
                            <ProtectedRoute requireClient requiredPage="conversations">
                              <Conversations />
                            </ProtectedRoute>
                          } />
                          <Route path="/transcripts" element={
                            <ProtectedRoute requireClient requiredPage="transcripts">
                              <Transcripts />
                            </ProtectedRoute>
                          } />
                          <Route path="/analytics" element={
                            <ProtectedRoute requireClient requiredPage="analytics">
                              <Analytics />
                            </ProtectedRoute>
                          } />
                          <Route path="/knowledge-base" element={
                            <ProtectedRoute requireClient requiredPage="knowledge_base">
                              <KnowledgeBase />
                            </ProtectedRoute>
                          } />
                          <Route path="/agent-settings" element={
                            <ProtectedRoute requireClient requiredPage="agent_settings">
                              <AgentSettings />
                            </ProtectedRoute>
                          } />
                          <Route path="/specs" element={
                            <ProtectedRoute requireClient requiredPage="specs">
                              <AgentSpecs />
                            </ProtectedRoute>
                          } />
                          <Route path="/guides" element={
                            <ProtectedRoute requireClient>
                              <Guides />
                            </ProtectedRoute>
                          } />
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
