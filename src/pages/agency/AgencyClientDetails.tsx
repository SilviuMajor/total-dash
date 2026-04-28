import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EyeOff } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { ClientOverview } from "@/components/client-management/ClientOverview";
import { ClientAgentAssignments } from "@/components/client-management/ClientAgentAssignments";
import { ClientSettings } from "@/components/client-management/ClientSettings";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";
import { ClientGuidesEditor } from "@/components/client-management/ClientGuidesEditor";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { CannedResponsesSettings } from "@/components/settings/CannedResponsesSettings";
import { AuditLog } from "@/components/settings/AuditLog";
import { RolesManagement } from "@/components/settings/RolesManagement";


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
  created_at: string | null;
  agency_id: string | null;
}

function CompanySettingsPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("departments");
  const [capabilities, setCapabilities] = useState<Record<string, any>>({});
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [teamSubTab, setTeamSubTab] = useState<"roles" | "team">("team");

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
    { id: "team", label: "Team & Permissions", capKey: "client_team_enabled" },
    { id: "canned-responses", label: "Canned Responses", capKey: "client_canned_responses_enabled" },
    { id: "general", label: "General", capKey: "client_general_enabled" },
    { id: "audit-log", label: "Audit Log", capKey: "client_audit_log_enabled" },
  ];

  return (
    <div className="space-y-6">
      {/* Master toggle — destructive border signals agency-wide cap */}
      <Card className="p-4 bg-destructive/5 border-l-4 border-l-destructive border-y-border/50 border-r-border/50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show Company Settings page to this client</p>
            <p className="text-xs text-muted-foreground mt-0.5">Agency-wide cap — turning this off hides the entire Company Settings page for every user at this client. Individual tabs below also have their own toggles.</p>
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
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage departments. Disabling hides this tab for every user at this client.</p>
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
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage team members. Disabling hides this tab for every user at this client.</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_team_enabled")}
                onCheckedChange={(v) => updateCapability("client_team_enabled", v)}
              />
            </div>
          </Card>
          <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTeamSubTab("roles")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  teamSubTab === "roles"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setTeamSubTab("team")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  teamSubTab === "team"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Team
              </button>
            </div>

            {teamSubTab === "roles" && <RolesManagement clientId={clientId} />}
            {teamSubTab === "team" && <ClientUsersManagement clientId={clientId} />}
        </TabsContent>


        <TabsContent value="canned-responses">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_canned_responses_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view and manage canned responses. Disabling hides this tab for every user at this client.</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_canned_responses_enabled")}
                onCheckedChange={(v) => updateCapability("client_canned_responses_enabled", v)}
              />
            </div>
          </Card>
          <CannedResponsesSettings clientId={clientId} />
        </TabsContent>

        <TabsContent value="general">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_general_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view company information. Disabling hides this tab for every user at this client.</p>
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

        <TabsContent value="audit-log">
          <Card className="p-4 bg-card border-border/50 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: isTabEnabled("client_audit_log_enabled") ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <div>
                  <Label className="text-sm font-medium">Visible to Client</Label>
                  <p className="text-xs text-muted-foreground">Allow clients to view the audit log. Disabling hides this tab for every user at this client.</p>
                </div>
              </div>
              <Switch
                checked={isTabEnabled("client_audit_log_enabled")}
                onCheckedChange={(v) => updateCapability("client_audit_log_enabled", v)}
              />
            </div>
          </Card>
          <AuditLog clientId={clientId} isAgencyView={true} />
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
  const { activeSession } = useImpersonation();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = tab || "overview";

  const agencyId = profile?.agency?.id 
    || previewAgency?.id 
    || activeSession?.agency_id 
    || sessionStorage.getItem('preview_agency') 
    || undefined;

  useEffect(() => {
    if (agencyId) {
      loadClientData();
    }
  }, [clientId, agencyId]);

  const loadClientData = async () => {
    if (!clientId || !agencyId) return;
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
    return <PageSkeleton />;
  }

  if (!client) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/agency/clients" />
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

      </Tabs>
    </div>
  );
}
