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

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Default to client auth when not logged in
        navigate('/client/auth');
      } else if (requireAdmin && profile?.role !== 'admin') {
        navigate('/');
      } else if (requireClient && profile?.role === 'admin') {
        navigate('/admin/clients');
      } else if (requiredPage && !hasPageAccess(requiredPage)) {
        // Silent redirect to first available page
        if (hasPageAccess('dashboard')) {
          navigate('/', { replace: true });
        } else if (hasPageAccess('analytics')) {
          navigate('/analytics', { replace: true });
        } else if (hasPageAccess('transcripts')) {
          navigate('/transcripts', { replace: true });
        } else if (hasPageAccess('settings')) {
          navigate('/settings', { replace: true });
        } else {
          navigate('/client/auth', { replace: true });
        }
      }
    }
  }, [user, profile, loading, navigate, requireAdmin, requireClient, requiredPage, hasPageAccess, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (requireAdmin && profile?.role !== 'admin') || (requireClient && profile?.role === 'admin')) {
    return null;
  }

  // Check page permissions for client users
  if (requiredPage && !hasPageAccess(requiredPage)) {
    return null;
  }

  return <>{children}</>;
}
