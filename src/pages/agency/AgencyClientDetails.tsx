import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, EyeOff } from "lucide-react";
import { ClientOverview } from "@/components/client-management/ClientOverview";
import { ClientAgentAssignments } from "@/components/client-management/ClientAgentAssignments";
import { ClientSettings } from "@/components/client-management/ClientSettings";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";
import { ClientGuidesEditor } from "@/components/client-management/ClientGuidesEditor";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { DefaultPermissionsCard } from "@/components/client-management/DefaultPermissionsCard";
import { CannedResponsesSettings } from "@/components/settings/CannedResponsesSettings";


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
  agency_id: string;
}

function CompanySettingsPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("departments");
  const [capabilities, setCapabilities] = useState<Record<string, any>>({});
  const [masterEnabled, setMasterEnabled] = useState(true);

  useEffect(() => {
    loadCapabilities();
  }, [clientId]);

  const loadCapabilities = async () => {
    const { data } = await supabase
      .from('client_settings')
      .select('admin_capabilities')
      .eq('client_id', clientId)
      .single();
    if (data?.admin_capabilities) {
      const caps = data.admin_capabilities as Record<string, any>;
      setCapabilities(caps);
      setMasterEnabled(caps.settings_page_enabled !== false);
    }
  };

  const updateCapability = async (key: string, value: boolean) => {
    const newCaps = { ...capabilities, [key]: value };
    setCapabilities(newCaps);
    if (key === 'settings_page_enabled') setMasterEnabled(value);
    const { error } = await supabase
      .from('client_settings')
      .upsert({ client_id: clientId, admin_capabilities: newCaps }, { onConflict: 'client_id' });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const isTabEnabled = (key: string) => capabilities[key] !== false;

  const subTabs = [
    { id: "departments", label: "Departments", capKey: "client_departments_enabled" },
    { id: "team", label: "Team", capKey: "client_team_enabled" },
    { id: "permissions", label: "Permissions", capKey: "client_permissions_enabled" },
    { id: "canned-responses", label: "Canned Responses", capKey: "client_canned_responses_enabled" },
    { id: "general", label: "General", capKey: "client_general_enabled" },
  ];

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <Card className="p-4 bg-card border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Switch checked={masterEnabled} onCheckedChange={(v) => updateCapability('settings_page_enabled', v)} className="scale-75" />
            </div>
            <div>
              <p className="text-sm font-medium">Company Settings Page Visibility</p>
              <p className="text-xs text-muted-foreground">Show or hide the entire Company Settings page for this client</p>
            </div>
          </div>
          <Switch checked={masterEnabled} onCheckedChange={(v) => updateCapability('settings_page_enabled', v)} />
        </div>
      </Card>

      {/* Sub-tabs mirroring client view */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <TabsList>
          {subTabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="relative">
              {tab.label}
              {!isTabEnabled(tab.capKey) && (
                <EyeOff className="h-3 w-3 ml-1 text-muted-foreground" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="departments">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_departments_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage departments</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_departments_enabled")}
                onCheckedChange={(v) => updateCapability("client_departments_enabled", v)}
              />
            </div>
          </Card>
          <DepartmentManagement clientId={clientId} />
        </TabsContent>

        <TabsContent value="team">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_team_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage team members</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_team_enabled")}
                onCheckedChange={(v) => updateCapability("client_team_enabled", v)}
              />
            </div>
          </Card>
          <ClientUsersManagement clientId={clientId} />
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_permissions_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage permissions</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_permissions_enabled")}
                onCheckedChange={(v) => updateCapability("client_permissions_enabled", v)}
              />
            </div>
          </Card>
          <DefaultPermissionsCard clientId={clientId} />
        </TabsContent>

        <TabsContent value="canned-responses">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_canned_responses_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage canned responses</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_canned_responses_enabled")}
                onCheckedChange={(v) => updateCapability("client_canned_responses_enabled", v)}
              />
            </div>
          </Card>
          <CannedResponsesSettings />
        </TabsContent>

        <TabsContent value="general">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_general_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view company information</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_general_enabled")}
                onCheckedChange={(v) => updateCapability("client_general_enabled", v)}
              />
            </div>
          </Card>
          <ClientSettings client={{ id: clientId } as any} onUpdate={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AgencyClientDetails() {
  const { clientId, tab } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = tab || "overview";

  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;

  useEffect(() => {
    if (agencyId) {
      loadClientData();
    }
  }, [clientId, agencyId]);

  const loadClientData = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .single();

      if (error) throw error;
      
      if (!data) {
        throw new Error('Client not found or access denied');
      }
      
      setClient(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load client",
        variant: "destructive",
      });
      navigate('/agency/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    navigate(`/agency/clients/${clientId}/${value}`);
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
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/agency/clients')}
          className="border-border/50"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">Client Management Dashboard</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="company-settings">Company Settings</TabsTrigger>
          
        </TabsList>

        <TabsContent value="overview">
          <ClientOverview client={client} onUpdate={loadClientData} />
        </TabsContent>

        <TabsContent value="agents">
          <ClientAgentAssignments clientId={client.id} />
        </TabsContent>

        <TabsContent value="guides">
          <ClientGuidesEditor clientId={client.id} />
        </TabsContent>

        <TabsContent value="company-settings">
          <CompanySettingsPanel clientId={client.id} />
        </TabsContent>

        <TabsContent value="audit-log">
          <AuditLog clientId={client.id} isAgencyView={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
