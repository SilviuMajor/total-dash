import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { ClientOverview } from "@/components/client-management/ClientOverview";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { ClientAgentAssignments } from "@/components/client-management/ClientAgentAssignments";
import { ClientSettings } from "@/components/client-management/ClientSettings";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";

interface ClientData {
  id: string;
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company_address: string | null;
  status: string | null;
  deleted_at: string | null;
  scheduled_deletion_date: string | null;
  subscription_status: string | null;
  is_active: boolean | null;
  created_at: string;
}

export default function ClientDetails() {
  const { clientId, tab } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = tab || "overview";

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      setClient(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate('/admin/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    navigate(`/admin/clients/${clientId}/${value}`);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Card className="p-8 bg-gradient-card border-border/50 animate-pulse">
          <div className="h-64"></div>
        </Card>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/clients')}
          className="border-border/50"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">{client.name}</h1>
          <p className="text-muted-foreground">Client Management Dashboard</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverview client={client} onUpdate={loadClientData} />
        </TabsContent>

        <TabsContent value="users">
          <ClientUsersManagement clientId={client.id} />
        </TabsContent>

        <TabsContent value="agents">
          <ClientAgentAssignments clientId={client.id} />
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6">
            <ClientSettings client={client} onUpdate={loadClientData} />
            <DepartmentManagement clientId={client.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
