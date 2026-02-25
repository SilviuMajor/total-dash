import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClient?: boolean;
  requiredPage?: 'conversations' | 'transcripts' | 'analytics' | 'knowledge_base' | 'agent_settings' | 'specs';
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requireClient = false,
  requiredPage 
}: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedAgentPermissions } = useClientAgentContext();
  const { 
    userType, 
    loading: mtLoading,
    isPreviewMode: agencyPreviewMode, 
    previewAgency, 
    isClientPreviewMode, 
    previewDepth,
    isProcessingPreviewParams
  } = useMultiTenantAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Combined loading state - wait for both auth contexts and preview param processing
  const loading = authLoading || mtLoading || isProcessingPreviewParams;
  
  // Admin in client preview mode can access client routes (based on multi-tenant preview depth)
  const isAdminPreview =
    profile?.role === 'admin' &&
    (previewDepth === 'agency_to_client' || previewDepth === 'client');
  
  // Agency in client preview mode can access client routes
  const isAgencyClientPreview =
    userType === 'agency' &&
    (previewDepth === 'agency_to_client' || previewDepth === 'client');

  // Super admin in ANY preview mode gets full access (simplified check)
  const isSuperAdminInPreview = 
    userType === 'super_admin' && 
    (previewDepth !== 'none' && previewDepth !== undefined);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Redirect to client login page
        navigate('/client/login');
      } else if (requireAdmin && profile?.role !== 'admin') {
        navigate('/');
      } else if (requireClient && profile?.role === 'admin' && !isAdminPreview && !isAgencyClientPreview && !isSuperAdminInPreview) {
        // Only redirect if NOT in preview mode
        navigate('/admin/clients');
      } else if (requiredPage && !isAdminPreview && !isAgencyClientPreview && !isSuperAdminInPreview) {
        // Check agent-based permissions for client users
        if (profile?.role === 'client' && selectedAgentPermissions) {
          const hasAccess = selectedAgentPermissions[requiredPage as keyof typeof selectedAgentPermissions];
          
          if (!hasAccess) {
            // Redirect to first available page
            const redirectOrder = ['conversations', 'transcripts', 'analytics', 'knowledge_base', 'agent_settings'];
            
            for (const page of redirectOrder) {
              if (selectedAgentPermissions[page as keyof typeof selectedAgentPermissions]) {
                const pathMap: Record<string, string> = {
                  conversations: '/',
                  transcripts: '/transcripts',
                  analytics: '/analytics',
                  knowledge_base: '/knowledge-base',
                  agent_settings: '/agent-settings',
                };
                navigate(pathMap[page], { replace: true });
                return;
              }
            }
            
            // No permissions at all
            navigate('/client/login', { replace: true });
          }
        }
      }
    }
  }, [user, profile, loading, navigate, requireAdmin, requireClient, requiredPage, selectedAgentPermissions, location.pathname, isAdminPreview, isAgencyClientPreview, isSuperAdminInPreview]);

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <div className="w-64 h-screen bg-muted animate-pulse shrink-0" />
        <div className="flex-1 p-8 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || (requireAdmin && profile?.role !== 'admin') || (requireClient && profile?.role === 'admin' && !isAdminPreview && !isAgencyClientPreview && !isSuperAdminInPreview)) {
    return null;
  }

  // Check page permissions for client users (skip for admin/agency/super_admin preview)
  if (requiredPage && profile?.role === 'client' && selectedAgentPermissions && !isAdminPreview && !isAgencyClientPreview && !isSuperAdminInPreview) {
    const hasAccess = selectedAgentPermissions[requiredPage as keyof typeof selectedAgentPermissions];
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
