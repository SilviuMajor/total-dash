import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { GracePeriodBanner } from "./GracePeriodBanner";

interface AgencyProtectedRouteProps {
  children: ReactNode;
}

export function AgencyProtectedRoute({ children }: AgencyProtectedRouteProps) {
  const { userType, loading, profile, isPreviewMode, isValidatingToken } = useMultiTenantAuth();
  const { isImpersonating, activeSession } = useImpersonation();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const tokenInUrl = searchParams.get('token');
  const tokenInSession = sessionStorage.getItem('preview_token');
  const hasToken = !!(tokenInUrl || tokenInSession);

  // Check bridge values synchronously — don't wait for async impersonation restore
  const hasBridgePreview = sessionStorage.getItem('preview_mode') === 'agency';
  const hasImpersonationSession = !!sessionStorage.getItem('impersonation_session_id');

  useEffect(() => {
    const checkSubscription = async () => {
      if (!profile?.agency?.id) {
        setCheckingSubscription(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('agency_subscriptions')
          .select('status, grace_period_ends_at')
          .eq('agency_id', profile.agency.id)
          .single();
        if (error) throw error;
        setSubscriptionStatus(data.status);
        setGracePeriodEndsAt(data.grace_period_ends_at);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setCheckingSubscription(false);
      }
    };

    if (userType === 'agency' && !loading) {
      checkSubscription();
    } else {
      setCheckingSubscription(false);
    }
  }, [profile?.agency?.id, userType, loading]);

  // Wait for auth only — not impersonation loading
  if (loading || checkingSubscription || isValidatingToken || (hasToken && !userType)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow access if: preview mode (bridge), active impersonation, or valid token
  const isValidPreview = isPreviewMode && userType === 'super_admin';
  const isImpersonatingAgency = isImpersonating && activeSession?.target_type === 'agency' && userType === 'super_admin';
  const hasBridgeAccess = (hasBridgePreview || hasImpersonationSession) && userType === 'super_admin';

  if (isValidPreview || isImpersonatingAgency || hasBridgeAccess) {
    return <>{children}</>;
  }

  // Regular agency user
  if (userType === 'agency') {
    const isInGracePeriod = gracePeriodEndsAt && new Date(gracePeriodEndsAt) > new Date();
    const gracePeriodExpired = gracePeriodEndsAt && new Date(gracePeriodEndsAt) <= new Date();

    if (subscriptionStatus === 'past_due' && gracePeriodExpired) {
      return <Navigate to="/agency/subscription-required" replace />;
    }

    const blockedStatuses = ['canceled', 'incomplete', 'incomplete_expired'];
    if (subscriptionStatus && blockedStatuses.includes(subscriptionStatus)) {
      return <Navigate to="/agency/subscription-required" replace />;
    }

    return (
      <>
        {isInGracePeriod && <GracePeriodBanner gracePeriodEndsAt={gracePeriodEndsAt} />}
        {children}
      </>
    );
  }

  // Not authorized
  return <Navigate to="/agency/login" replace />;
}
