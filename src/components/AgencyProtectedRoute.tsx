import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { GracePeriodBanner } from "./GracePeriodBanner";

interface AgencyProtectedRouteProps {
  children: ReactNode;
}

export function AgencyProtectedRoute({ children }: AgencyProtectedRouteProps) {
  const { userType, loading, profile, isPreviewMode, isValidatingToken } = useMultiTenantAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<string | null>(null);

  // Check for token in URL or sessionStorage
  const searchParams = new URLSearchParams(window.location.search);
  const tokenInUrl = searchParams.get('token');
  const tokenInSession = sessionStorage.getItem('preview_token');
  const hasToken = !!(tokenInUrl || tokenInSession);

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

  // Show loading if validating token, checking subscription, or if token exists but userType not set yet
  if (loading || checkingSubscription || isValidatingToken || (hasToken && !userType)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if in preview mode via token
  const isValidPreview = isPreviewMode && userType === 'super_admin' && hasToken;

  // Allow super admins with valid preview token
  if (isValidPreview) {
    return <>{children}</>;
  }

  // Don't redirect if token is being validated or if no token and not agency user
  if (!hasToken && !isValidatingToken && userType !== 'agency') {
    return <Navigate to="/agency/login" replace />;
  }

  // Check grace period logic
  const isInGracePeriod = gracePeriodEndsAt && new Date(gracePeriodEndsAt) > new Date();
  const gracePeriodExpired = gracePeriodEndsAt && new Date(gracePeriodEndsAt) <= new Date();

  // Block access if grace period has expired
  if (subscriptionStatus === 'past_due' && gracePeriodExpired) {
    return <Navigate to="/agency/subscription-required" replace />;
  }

  // Block access for canceled/incomplete subscriptions
  const blockedStatuses = ['canceled', 'incomplete', 'incomplete_expired'];
  if (subscriptionStatus && blockedStatuses.includes(subscriptionStatus)) {
    return <Navigate to="/agency/subscription-required" replace />;
  }

  // Show grace period banner if in grace period
  return (
    <>
      {isInGracePeriod && <GracePeriodBanner gracePeriodEndsAt={gracePeriodEndsAt} />}
      {children}
    </>
  );
}
