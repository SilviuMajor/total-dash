import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClient?: boolean;
  requiredPage?: string;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requireClient = false,
  requiredPage 
}: ProtectedRouteProps) {
  const { user, profile, loading, hasPageAccess } = useAuth();
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
      } else if (requiredPage && !hasPageAccess(requiredPage) && !isAdminPreview) {
        // Skip page permission check for admin preview
        if (hasPageAccess('dashboard')) {
          navigate('/', { replace: true });
        } else if (hasPageAccess('analytics')) {
          navigate('/analytics', { replace: true });
        } else if (hasPageAccess('transcripts')) {
          navigate('/transcripts', { replace: true });
        } else if (hasPageAccess('settings')) {
          navigate('/settings', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      }
    }
  }, [user, profile, loading, navigate, requireAdmin, requireClient, requiredPage, hasPageAccess, location.pathname, isAdminPreview]);

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
  if (requiredPage && !hasPageAccess(requiredPage) && !isAdminPreview) {
    return null;
  }

  return <>{children}</>;
}
