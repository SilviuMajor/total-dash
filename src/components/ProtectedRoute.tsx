import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  const { user, profile, loading } = useAuth();
  const { selectedAgentPermissions } = useClientAgentContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse URL query parameters for preview mode
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const previewClientId = searchParams.get('clientId');
  
  // Admin in preview mode can access client routes
  const isAdminPreview = profile?.role === 'admin' && isPreviewMode && previewClientId;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Redirect to unified auth page
        navigate('/auth');
      } else if (requireAdmin && profile?.role !== 'admin') {
        navigate('/');
      } else if (requireClient && profile?.role === 'admin' && !isAdminPreview) {
        // Only redirect if NOT in preview mode
        navigate('/admin/clients');
      } else if (requiredPage && !isAdminPreview) {
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
            navigate('/auth', { replace: true });
          }
        }
      }
    }
  }, [user, profile, loading, navigate, requireAdmin, requireClient, requiredPage, selectedAgentPermissions, location.pathname, isAdminPreview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (requireAdmin && profile?.role !== 'admin') || (requireClient && profile?.role === 'admin' && !isAdminPreview)) {
    return null;
  }

  // Check page permissions for client users (skip for admin preview)
  if (requiredPage && profile?.role === 'client' && selectedAgentPermissions && !isAdminPreview) {
    const hasAccess = selectedAgentPermissions[requiredPage as keyof typeof selectedAgentPermissions];
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
