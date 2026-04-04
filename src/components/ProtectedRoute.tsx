import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useImpersonation } from "@/hooks/useImpersonation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClient?: boolean;
  requiredPage?: 'conversations' | 'transcripts' | 'analytics' | 'knowledge_base' | 'agent_settings' | 'specs' | 'guides' | 'settings_page' | 'audit_log';
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requireClient = false,
  requiredPage 
}: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { selectedAgentPermissions } = useClientAgentContext();
  const { isImpersonating, impersonationMode } = useImpersonation();
  const { 
    userType, 
    loading: mtLoading,
    previewDepth,
    isProcessingPreviewParams
  } = useMultiTenantAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Only wait for auth — NOT impersonation loading
  const loading = authLoading || mtLoading || isProcessingPreviewParams;

  // Check if user has access via preview or impersonation (synchronous from sessionStorage)
  const hasPreviewAccess = (() => {
    if (previewDepth !== 'none' && previewDepth !== undefined) return true;
    if (isImpersonating) return true;
    // Also check bridge values synchronously as fallback
    const bridgeMode = sessionStorage.getItem('preview_mode');
    if (bridgeMode) return true;
    return false;
  })();

  const isImpersonationFullAccess = isImpersonating && impersonationMode === 'full_access';

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/client/login');
      } else if (userType === 'super_admin' && !hasPreviewAccess) {
        // Super admin with no active preview/impersonation — go to admin
        navigate('/admin/agencies', { replace: true });
      } else if (requireAdmin && profile?.role !== 'admin') {
        navigate('/');
      } else if (requireClient && profile?.role === 'admin' && !hasPreviewAccess && !isImpersonationFullAccess) {
        navigate('/admin/clients');
      } else if (requiredPage && !hasPreviewAccess && !isImpersonationFullAccess) {
        if (profile?.role === 'client' && selectedAgentPermissions) {
          const hasAccess = selectedAgentPermissions[requiredPage as keyof typeof selectedAgentPermissions];
          if (!hasAccess) {
            const redirectOrder = ['conversations', 'transcripts', 'analytics', 'knowledge_base', 'agent_settings', 'specs', 'guides'];
            for (const page of redirectOrder) {
              if (selectedAgentPermissions[page as keyof typeof selectedAgentPermissions]) {
                const pathMap: Record<string, string> = {
                  conversations: '/',
                  transcripts: '/text-transcripts',
                  analytics: '/analytics',
                  knowledge_base: '/knowledge-base',
                  agent_settings: '/agent-settings',
                  specs: '/specs',
                  guides: '/guides',
                };
                navigate(pathMap[page], { replace: true });
                return;
              }
            }
            navigate('/client/login', { replace: true });
          }
        }
      }
    }
  }, [user, profile, loading, navigate, requireAdmin, requireClient, requiredPage, selectedAgentPermissions, location.pathname, hasPreviewAccess, isImpersonationFullAccess, userType]);

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

  if (!user || (requireAdmin && profile?.role !== 'admin') || (requireClient && profile?.role === 'admin' && !hasPreviewAccess && !isImpersonationFullAccess)) {
    return null;
  }

  if (requiredPage && profile?.role === 'client' && selectedAgentPermissions && !hasPreviewAccess && !isImpersonationFullAccess) {
    const hasAccess = selectedAgentPermissions[requiredPage as keyof typeof selectedAgentPermissions];
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
