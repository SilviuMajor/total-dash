import { useEffect, useState } from "react";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { RolesManagement } from "@/components/settings/RolesManagement";
import { CannedResponsesSettings } from "@/components/settings/CannedResponsesSettings";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const { user } = useAuth();
  const { isClientPreviewMode, previewClient, previewDepth } = useMultiTenantAuth();
  const { clientId: contextClientId, companySettingsPermissions } = useClientAgentContext();
  const [clientId, setClientId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, any>>({});
  const [client, setClient] = useState<any>(null);
  const [teamSubTab, setTeamSubTab] = useState<"roles" | "team">("roles");

  useEffect(() => {
    const isInPreview = isClientPreviewMode || previewDepth === 'agency_to_client' || previewDepth === 'client';
    if (isInPreview && previewClient?.id) {
      setClientId(previewClient.id);
      return;
    }
    if (contextClientId) {
      setClientId(contextClientId);
      return;
    }
    const loadClientId = async () => {
      if (!user) return;
      const { data } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single();
      if (data) setClientId(data.client_id);
    };
    loadClientId();
  }, [user, isClientPreviewMode, previewClient, previewDepth, contextClientId]);

  useEffect(() => {
    if (!clientId) return;
    const loadSettings = async () => {
      const { data: settings } = await supabase
        .from('client_settings')
        .select('admin_capabilities')
        .eq('client_id', clientId)
        .single();
      if (settings?.admin_capabilities) {
        setCapabilities(settings.admin_capabilities as Record<string, any>);
      }
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      if (clientData) setClient(clientData);
    };
    loadSettings();
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-lg font-semibold">Company Settings</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // In preview mode, show everything the agency has enabled
  // In normal mode, also check user's view permission
  const isInPreview = isClientPreviewMode || previewDepth === 'agency_to_client' || previewDepth === 'client';

  const showDepartments = capabilities.client_departments_enabled !== false &&
    (isInPreview || companySettingsPermissions?.settings_departments_view !== false);
  const showTeam = capabilities.client_team_enabled !== false &&
    (isInPreview || companySettingsPermissions?.settings_team_view !== false);
  const showCannedResponses = capabilities.client_canned_responses_enabled !== false &&
    (isInPreview || companySettingsPermissions?.settings_canned_responses_view !== false);
  const showGeneral = capabilities.client_general_enabled !== false &&
    (isInPreview || companySettingsPermissions?.settings_general_view !== false);

  const canManageDepartments = isInPreview || companySettingsPermissions?.settings_departments_manage === true;
  const canManageTeam = isInPreview || companySettingsPermissions?.settings_team_manage === true;
  const canManageCannedResponses = isInPreview || companySettingsPermissions?.settings_canned_responses_manage === true;
  const canManageGeneral = isInPreview || companySettingsPermissions?.settings_general_manage === true;

  const getDefaultTab = () => {
    if (showDepartments) return "departments";
    if (showTeam) return "team-permissions";
    if (showCannedResponses) return "canned-responses";
    if (showGeneral) return "general";
    return "departments";
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Company Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your organisation, team, and preferences</p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="w-full">
        <TabsList>
          {showDepartments && <TabsTrigger value="departments">Departments</TabsTrigger>}
          {showTeam && <TabsTrigger value="team-permissions">Team & Permissions</TabsTrigger>}
          {showCannedResponses && <TabsTrigger value="canned-responses">Canned Responses</TabsTrigger>}
          {showGeneral && <TabsTrigger value="general">General</TabsTrigger>}
        </TabsList>

        {showDepartments && (
          <TabsContent value="departments" className="space-y-6">
            <DepartmentManagement clientId={clientId} readOnly={!canManageDepartments} />
          </TabsContent>
        )}

        {showTeam && (
          <TabsContent value="team-permissions" className="space-y-6">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
              <button
                onClick={() => setTeamSubTab("roles")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  teamSubTab === "roles"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setTeamSubTab("team")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  teamSubTab === "team"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Team
              </button>
            </div>

            {teamSubTab === "roles" && <RolesManagement clientId={clientId} />}
            {teamSubTab === "team" && <ClientUsersManagement clientId={clientId} />}
          </TabsContent>
        )}

        {showCannedResponses && (
          <TabsContent value="canned-responses" className="space-y-6">
            <CannedResponsesSettings />
          </TabsContent>
        )}

        {showGeneral && (
          <TabsContent value="general" className="space-y-6">
            <Card className="p-6 bg-card border-border/50">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Company Information</h3>
                  <p className="text-sm text-muted-foreground">Your organisation details</p>
                </div>
                {client && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Company Name</Label>
                      <Input value={client.name || ''} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">Contact your agency to update your company name</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Contact Email</Label>
                      <Input value={client.contact_email || ''} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Contact Phone</Label>
                      <Input value={client.contact_phone || ''} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Address</Label>
                      <Input value={client.company_address || ''} disabled className="bg-muted" />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
