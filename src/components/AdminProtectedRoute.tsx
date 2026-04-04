import { ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { Loader2 } from "lucide-react";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { userType, loading } = useMultiTenantAuth();
  const { isImpersonating, endImpersonation, loading: impersonationLoading } = useImpersonation();
  const endingRef = useRef(false);

  // Auto-end impersonation when super admin navigates to /admin/*
  useEffect(() => {
    if (!impersonationLoading && isImpersonating && userType === 'super_admin' && !endingRef.current) {
      endingRef.current = true;
      endImpersonation().finally(() => {
        endingRef.current = false;
      });
    }
  }, [impersonationLoading, isImpersonating, userType, endImpersonation]);

  if (loading || impersonationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // While auto-ending impersonation, show loader
  if (isImpersonating && userType === 'super_admin') {
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
