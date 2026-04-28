import { useEffect, useState } from "react";
import { DepartmentManagement } from "@/components/client-management/DepartmentManagement";
import { ClientUsersManagement } from "@/components/client-management/ClientUsersManagement";
import { RolesManagement } from "@/components/settings/RolesManagement";
import { CannedResponsesSettings } from "@/components/settings/CannedResponsesSettings";
import { AuditLog } from "@/components/settings/AuditLog";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useImpersonation } from "@/hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Auto-corrects teamSubTab to a visible value when the current selection is
// hidden by permissions. Lives at module scope so the effect can be co-located
// with the visibility props rather than added to the parent's effect list.
function SubTabGuard({
  showDepartments,
  canManageTeam,
  teamSubTab,
  setTeamSubTab,
}: {
  showDepartments: boolean;
  canManageTeam: boolean;
  teamSubTab: "departments" | "team" | "roles";
  setTeamSubTab: (v: "departments" | "team" | "roles") => void;
}) {
  useEffect(() => {
    if (teamSubTab === "departments" && !showDepartments) {
      setTeamSubTab("team");
    } else if (teamSubTab === "roles" && !canManageTeam) {
      setTeamSubTab("team");
    }
  }, [teamSubTab, showDepartments, canManageTeam, setTeamSubTab]);
  return null;
}

export default function Settings() {
  const { user } = useAuth();
  const { isClientPreviewMode, previewClient, previewDepth } = useMultiTenantAuth();
  const { clientId: contextClientId, companySettingsPermissions } = useClientAgentContext();
  const { isImpersonating, impersonationMode } = useImpersonation();
  const isImpersonationViewAsUser = isImpersonating && impersonationMode === 'view_as_user';
  const [clientId, setClientId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, any>>({});
  const [client, setClient] = useState<any>(null);
  const [teamSubTab, setTeamSubTab] = useState<"departments" | "team" | "roles">("departments");

  useEffect(() => {
    const isInPreview = isClientPreviewMode || previewDepth === 'agency_to_client' || previewDepth === 'client';
    if (isInPreview && previewClient?.id) {
      setClientId(previewClient.id);
      return;
    }
    if (isImpersonating && !previewClient?.id && contextClientId) {
      // Impersonation mode — clientId comes from useClientAgentContext
      setClientId(contextClientId);
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
      <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
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
  const isInPreviewOrImpersonating = isInPreview || isImpersonating;

  const showDepartments = capabilities.client_departments_enabled !== false &&
    (isInPreviewOrImpersonating || companySettingsPermissions?.settings_departments_view !== false);
  const showTeam = capabilities.client_team_enabled !== false &&
    (isInPreviewOrImpersonating || companySettingsPermissions?.settings_team_view !== false);
  const showCannedResponses = capabilities.client_canned_responses_enabled !== false &&
    (isInPreviewOrImpersonating || companySettingsPermissions?.settings_canned_responses_view !== false);
  const showGeneral = capabilities.client_general_enabled !== false &&
    (isInPreviewOrImpersonating || companySettingsPermissions?.settings_general_view !== false);
  // Audit Log uses the same default-allow pattern (!== false) as the other tabs
  // for consistency. To keep a tab default-off, set the capability/permission
  // explicitly to false in seeds/templates rather than relying on operator drift.
  const showAuditLog = capabilities.client_audit_log_enabled !== false &&
    (isInPreviewOrImpersonating || companySettingsPermissions?.settings_audit_log_view !== false);

  const canManageDepartments = !isImpersonationViewAsUser && (isInPreview || companySettingsPermissions?.settings_departments_manage === true);
  const canManageTeam = !isImpersonationViewAsUser && (isInPreview || companySettingsPermissions?.settings_team_manage === true);
  const canManageCannedResponses = !isImpersonationViewAsUser && (isInPreview || companySettingsPermissions?.settings_canned_responses_manage === true);
  const canManageGeneral = !isImpersonationViewAsUser && (isInPreview || companySettingsPermissions?.settings_general_manage === true);

  const getDefaultTab = () => {
    if (showTeam) return "team-permissions";
    if (showCannedResponses) return "canned-responses";
    if (showGeneral) return "general";
    return "team-permissions";
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Company Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your organisation, team, and preferences</p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="w-full">
        <TabsList>
          {showTeam && <TabsTrigger value="team-permissions">Users & Departments</TabsTrigger>}
          {showCannedResponses && <TabsTrigger value="canned-responses">Canned Responses</TabsTrigger>}
          {showGeneral && <TabsTrigger value="general">General</TabsTrigger>}
          {showAuditLog && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
        </TabsList>

        {showTeam && (
          <TabsContent value="team-permissions" className="space-y-6">
            {/*
              Sub-tab visibility:
              - Departments: gated by showDepartments (Layer-2 ceiling + Layer-3/4 view)
              - Users: always shown when the parent Team tab is visible
              - Roles: management-only (settings_team_manage). Hidden for view-only
                users so they can't open a UI whose toggles silently fail at the DB.
              The active sub-tab is auto-corrected if it points at a hidden one.
            */}
            <SubTabGuard
              showDepartments={showDepartments}
              canManageTeam={canManageTeam}
              teamSubTab={teamSubTab}
              setTeamSubTab={setTeamSubTab}
            />
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
              {showDepartments && (
                <button
                  onClick={() => setTeamSubTab("departments")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    teamSubTab === "departments"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Departments
                  {!canManageDepartments && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">View only</Badge>
                  )}
                </button>
              )}
              <button
                onClick={() => setTeamSubTab("team")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  teamSubTab === "team"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Users
                {!canManageTeam && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">View only</Badge>
                )}
              </button>
              {canManageTeam && (
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
              )}
            </div>

            {teamSubTab === "departments" && showDepartments && <DepartmentManagement clientId={clientId} readOnly={!canManageDepartments} />}
            {teamSubTab === "team" && <ClientUsersManagement clientId={clientId} readOnly={!canManageTeam} />}
            {teamSubTab === "roles" && canManageTeam && <RolesManagement clientId={clientId} />}
          </TabsContent>
        )}

        {showCannedResponses && (
          <TabsContent value="canned-responses" className="space-y-6">
            <CannedResponsesSettings readOnly={!canManageCannedResponses} />
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
        {showAuditLog && clientId && (
          <TabsContent value="audit-log" className="space-y-6">
            <AuditLog clientId={clientId} isAgencyView={isInPreviewOrImpersonating} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
