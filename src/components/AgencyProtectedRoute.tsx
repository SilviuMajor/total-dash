import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Loader2 } from "lucide-react";

interface AgencyProtectedRouteProps {
  children: ReactNode;
}

export function AgencyProtectedRoute({ children }: AgencyProtectedRouteProps) {
  const { userType, loading } = useMultiTenantAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userType !== 'agency') {
    return <Navigate to="/agency/login" replace />;
  }

  return <>{children}</>;
}
