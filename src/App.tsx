import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import AdminAuth from "./pages/AdminAuth";
import ClientAuth from "./pages/ClientAuth";
import Settings from "./pages/Settings";
import AdminClients from "./pages/admin/Clients";
import AdminAgents from "./pages/admin/Agents";
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
              {/* Auth Routes */}
              <Route path="/admin/auth" element={<AdminAuth />} />
              <Route path="/client/auth" element={<ClientAuth />} />
              
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
                              <ProtectedRoute requireClient>
                                <ClientAgentDashboard />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/analytics" 
                            element={
                              <ProtectedRoute requireClient>
                                <ClientAgentAnalytics />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/transcripts" 
                            element={
                              <ProtectedRoute requireClient>
                                <ClientAgentTranscripts />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/settings" 
                            element={
                              <ProtectedRoute requireClient>
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
