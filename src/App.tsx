import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Transcripts from "./pages/Transcripts";
import Settings from "./pages/Settings";
import AdminClients from "./pages/admin/Clients";
import AdminAgents from "./pages/admin/Agents";
import AdminSettings from "./pages/admin/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full bg-background">
                    <Sidebar />
                    <main className="flex-1 p-8 overflow-y-auto">
                      <Routes>
                        {/* Client Routes */}
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/transcripts" element={<Transcripts />} />
                        <Route path="/settings" element={<Settings />} />

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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
