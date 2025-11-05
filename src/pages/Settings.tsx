import { useEffect, useState } from "react";
import { TeamMembersCard } from "@/components/client-management/TeamMembersCard";
import { DefaultPermissionsCard } from "@/components/client-management/DefaultPermissionsCard";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <ClientUsersManagement clientId={clientId} />
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <DepartmentManagement clientId={clientId} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <DefaultPermissionsCard clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
