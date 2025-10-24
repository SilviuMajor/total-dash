import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AgencyProtectedRouteProps {
  children: ReactNode;
}

export function AgencyProtectedRoute({ children }: AgencyProtectedRouteProps) {
  const { userType, loading, profile, isPreviewMode } = useMultiTenantAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!profile?.agency?.id) {
        setCheckingSubscription(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('agency_subscriptions')
          .select('status, manual_override')
          .eq('agency_id', profile.agency.id)
          .single();

        if (error) throw error;

        setSubscriptionStatus(data.status);
        setManualOverride(data.manual_override || false);
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

  if (loading || checkingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow super admins in preview mode
  if (isPreviewMode && userType === 'super_admin') {
    return <>{children}</>;
  }

  if (userType !== 'agency') {
    return <Navigate to="/agency/login" replace />;
  }

  // Check subscription status (allow if manual override is enabled)
  const blockedStatuses = ['past_due', 'canceled', 'incomplete', 'incomplete_expired'];
  if (!manualOverride && subscriptionStatus && blockedStatuses.includes(subscriptionStatus)) {
    return <Navigate to="/agency/subscription-required" replace />;
  }

  return <>{children}</>;
}
