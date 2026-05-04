import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  type DetectedUserType,
  dashboardPathForUserType,
  userTypeLabel,
} from "@/lib/auth";
import { LogOut, ExternalLink } from "lucide-react";

interface WrongRoleBannerProps {
  userEmail: string;
  detected: DetectedUserType;
}

// Slim banner shown above a login form when the visitor is already signed
// in with a *different* role than the page expects. Replaces the
// over-eager auto-redirect from N12 so super_admin can view branded
// client login pages, agency staff can view client login, etc., without
// being kicked off the page they're trying to view.
export function WrongRoleBanner({ userEmail, detected }: WrongRoleBannerProps) {
  const handleGoToDashboard = () => {
    window.location.href = dashboardPathForUserType(detected);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const dashboardLabel =
    detected.type === 'super_admin' ? 'admin dashboard'
    : detected.type === 'agency' ? 'agency dashboard'
    : detected.type === 'client' ? 'client dashboard'
    : 'dashboard';

  return (
    <div className="w-full max-w-md mb-4 rounded-lg border border-peach-bg-2 bg-peach-bg px-4 py-3 text-sm">
      <p className="text-peach-fg">
        Already signed in as <span className="font-medium">{userEmail}</span>{' '}
        <span className="text-peach-fg">
          ({userTypeLabel(detected)})
        </span>.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={handleGoToDashboard}
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          Go to {dashboardLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="mr-1.5 h-3 w-3" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
