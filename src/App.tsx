import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import AdminClients from "./pages/admin/Clients";
import AdminAgents from "./pages/admin/Agents";
import AgentDetails from "./pages/admin/AgentDetails";
import AdminSettings from "./pages/admin/Settings";
import ClientDetails from "./pages/admin/ClientDetails";
import ClientAgentDashboard from "./pages/client/ClientAgentDashboard";
import ClientAgentAnalytics from "./pages/client/ClientAgentAnalytics";
import ClientAgentTranscripts from "./pages/client/ClientAgentTranscripts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientAgentProvider>
            <Routes>
              {/* Auth Route */}
              <Route path="/auth" element={<Auth />} />
              
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="flex min-h-screen w-full bg-background">
                      <Sidebar />
                      <main className="flex-1 p-8 overflow-y-auto">
                        <Routes>
                          {/* Client Routes - Agent-specific dashboards */}
                          <Route 
                            path="/" 
                            element={
                              <ProtectedRoute requireClient requiredPage="dashboard">
                                <ClientAgentDashboard />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/analytics" 
                            element={
                              <ProtectedRoute requireClient requiredPage="analytics">
                                <ClientAgentAnalytics />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/transcripts" 
                            element={
                              <ProtectedRoute requireClient requiredPage="transcripts">
                                <ClientAgentTranscripts />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/settings" 
                            element={
                              <ProtectedRoute requireClient requiredPage="settings">
                                <Settings />
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
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ClientAgentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
