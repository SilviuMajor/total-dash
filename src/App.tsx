import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientAgentProvider } from "./hooks/useClientAgentContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { AdminPreviewBanner } from "./components/AdminPreviewBanner";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import AdminClients from "./pages/admin/Clients";
import AdminAgents from "./pages/admin/Agents";
import AgentDetails from "./pages/admin/AgentDetails";
import AdminSettings from "./pages/admin/Settings";
import ClientDetails from "./pages/admin/ClientDetails";
import Conversations from "./pages/client/Conversations";
import Analytics from "./pages/client/Analytics";
import KnowledgeBase from "./pages/client/KnowledgeBase";
import AgentSettings from "./pages/client/AgentSettings";
import AgentSpecs from "./pages/client/AgentSpecs";
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
                      <div className="flex-1 flex flex-col">
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
