import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Loader2 } from "lucide-react";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { userType, loading } = useMultiTenantAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userType === 'super_admin') {
    return <>{children}</>;
  }

  // Signed-in non-super-admin → redirect to *their* dashboard, not to the
  // admin login page. Skip during impersonation (preview_mode bridge) so the
  // super_admin's own impersonation flow isn't bounced.
  const previewBridge = sessionStorage.getItem('preview_mode');
  if (previewBridge && previewBridge !== '') {
    return <>{children}</>;
  }

  if (userType === 'agency') return <Navigate to="/agency" replace />;
  if (userType === 'client') return <Navigate to="/" replace />;

  // No session at all
  return <Navigate to="/admin/login" replace />;
}
