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

  if (userType !== 'super_admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
