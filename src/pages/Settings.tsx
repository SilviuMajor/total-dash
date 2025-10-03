import { useEffect, useState } from "react";
import { TeamMembersCard } from "@/components/client-management/TeamMembersCard";
import { DefaultPermissionsCard } from "@/components/client-management/DefaultPermissionsCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const loadClientId = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setClientId(data.client_id);
      }
    };

    loadClientId();
  }, [user]);

  if (!clientId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your team and preferences</p>
      </div>

      <TeamMembersCard clientId={clientId} />
      <DefaultPermissionsCard clientId={clientId} />
    </div>
  );
}
