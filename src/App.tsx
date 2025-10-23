import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { MultiTenantAuthProvider } from "./hooks/useMultiTenantAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SuperAdminProtectedRoute } from "./components/SuperAdminProtectedRoute";
import { AgencyProtectedRoute } from "./components/AgencyProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { AdminPreviewBanner } from "./components/AdminPreviewBanner";
import Auth from "./pages/Auth";
import SuperAdminLogin from "./pages/superadmin/SuperAdminLogin";
import AgencyLogin from "./pages/agency/AgencyLogin";
import Agencies from "./pages/superadmin/Agencies";
import AgencyDetails from "./pages/superadmin/AgencyDetails";
import SubscriptionPlans from "./pages/superadmin/SubscriptionPlans";
import AgencyDashboard from "./pages/agency/AgencyDashboard";
import AgencyClients from "./pages/agency/AgencyClients";
import AgencyAgents from "./pages/agency/AgencyAgents";
import AgencySubscription from "./pages/agency/AgencySubscription";
import AgencySettings from "./pages/agency/AgencySettings";
import Settings from "./pages/Settings";
import AdminClients from "./pages/admin/Clients";
import AdminAgents from "./pages/admin/Agents";
import AgentDetails from "./pages/admin/AgentDetails";
import AdminSettings from "./pages/admin/Settings";
import ClientDetails from "./pages/admin/ClientDetails";
import Conversations from "./pages/client/Conversations";
import Transcripts from "./pages/client/Transcripts";
import Analytics from "./pages/client/Analytics";
import KnowledgeBase from "./pages/client/KnowledgeBase";
import AgentSettings from "./pages/client/AgentSettings";
import AgentSpecs from "./pages/client/AgentSpecs";
import Guides from "./pages/client/Guides";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MultiTenantAuthProvider>
          <AuthProvider>
            <ClientAgentProvider>
              <Routes>
                {/* Super Admin Routes */}
                <Route path="/super-admin/login" element={<SuperAdminLogin />} />
                <Route path="/super-admin/*" element={
                  <SuperAdminProtectedRoute>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <AdminPreviewBanner />
                        <main className="flex-1 p-8 overflow-y-auto">
                          <Routes>
                            <Route path="/" element={<Agencies />} />
                            <Route path="/agencies" element={<Agencies />} />
                            <Route path="/agencies/:id" element={<AgencyDetails />} />
                            <Route path="/plans" element={<SubscriptionPlans />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SuperAdminProtectedRoute>
                } />

                {/* Agency Routes */}
                <Route path="/agency/login" element={<AgencyLogin />} />
                <Route path="/agency/*" element={
                  <AgencyProtectedRoute>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <AdminPreviewBanner />
                        <main className="flex-1 p-8 overflow-y-auto">
                          <Routes>
                            <Route path="/" element={<AgencyDashboard />} />
                            <Route path="/clients" element={<AgencyClients />} />
                            <Route path="/agents" element={<AgencyAgents />} />
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
              
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="flex h-screen w-full bg-background overflow-hidden">
                      <Sidebar />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <AdminPreviewBanner />
                        <main className="flex-1 p-8 overflow-y-auto">
                          <Routes>
                          {/* Client Routes - Agent-specific pages */}
                          <Route 
                            path="/" 
                            element={
                              <ProtectedRoute requireClient requiredPage="conversations">
                                <Conversations />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/transcripts" 
                            element={
                              <ProtectedRoute requireClient requiredPage="transcripts">
                                <Transcripts />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/analytics"
                            element={
                              <ProtectedRoute requireClient requiredPage="analytics">
                                <Analytics />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/knowledge-base" 
                            element={
                              <ProtectedRoute requireClient requiredPage="knowledge_base">
                                <KnowledgeBase />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/agent-settings" 
                            element={
                              <ProtectedRoute requireClient requiredPage="agent_settings">
                                <AgentSettings />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/specs" 
                            element={
                              <ProtectedRoute requireClient requiredPage="specs">
                                <AgentSpecs />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/guides" 
                            element={
                              <ProtectedRoute requireClient>
                                <Guides />
                              </ProtectedRoute>
                            } 
                          />

                          {/* Admin Routes */}
                          <Route
                            path="/admin/clients"
                            element={
                              <ProtectedRoute requireAdmin>
                                <AdminClients />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/admin/clients/:clientId/:tab"
                            element={
                              <ProtectedRoute requireAdmin>
                                <ClientDetails />
                              </ProtectedRoute>
                            }
                          />
                <Route
                  path="/admin/agents"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminAgents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/agents/:agentId"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AgentDetails />
                    </ProtectedRoute>
                  }
                />
                          <Route
                            path="/admin/settings"
                            element={
                              <ProtectedRoute requireAdmin>
                                <AdminSettings />
                              </ProtectedRoute>
                            }
                          />

                          {/* 404 */}
                          <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              </Routes>
            </ClientAgentProvider>
          </AuthProvider>
        </MultiTenantAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
