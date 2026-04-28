import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Plus, Trash2, Shield } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Role {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  is_admin_tier: boolean;
  is_system: boolean;
  is_default: boolean;
  sort_order: number;
  client_permissions: Record<string, any>;
}

interface AgentTemplate {
  agent_id: string;
  agent_name: string;
  permissions: Record<string, any>;
}

interface RolesManagementProps {
  clientId: string;
}

const AGENT_PERMISSION_KEYS = [
  { key: "conversations", label: "Conversations" },
  { key: "transcripts", label: "Transcripts" },
  { key: "analytics", label: "Analytics" },
  { key: "specs", label: "Specifications" },
  { key: "knowledge_base", label: "Knowledge base" },
  { key: "guides", label: "Guides" },
  { key: "agent_settings", label: "Agent settings" },
];

const COMPANY_SETTINGS_TABS = [
  { key: "settings_departments", label: "Departments", capKey: "client_departments_enabled" },
  { key: "settings_team", label: "Team & permissions", capKey: "client_team_enabled" },
  { key: "settings_canned_responses", label: "Canned responses", capKey: "client_canned_responses_enabled" },
  { key: "settings_general", label: "General", capKey: "client_general_enabled" },
  { key: "settings_audit_log", label: "Audit log", capKey: "client_audit_log_enabled", viewOnly: true },
];

export function RolesManagement({ clientId }: RolesManagementProps) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, AgentTemplate[]>>({});
  const [agentCeilings, setAgentCeilings] = useState<Record<string, Record<string, any>>>({});
  const [clientCaps, setClientCaps] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [applyAllModal, setApplyAllModal] = useState<{ roleId: string; roleName: string } | null>(null);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (clientId) loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from("client_roles")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order");
      setRoles((rolesData || []) as Role[]);

      const { data: assignments } = await supabase
        .from("agent_assignments")
        .select("agent_id, agents(id, name, config)")
        .eq("client_id", clientId);

      const ceilings: Record<string, Record<string, any>> = {};
      (assignments || []).forEach((a: any) => {
        if (a.agents) ceilings[a.agents.id] = a.agents.config || {};
      });
      setAgentCeilings(ceilings);

      const { data: settings } = await supabase
        .from("client_settings")
        .select("admin_capabilities")
        .eq("client_id", clientId)
        .single();
      setClientCaps((settings?.admin_capabilities || {}) as Record<string, any>);

      const { data: templates } = await supabase
        .from("role_permission_templates")
        .select("role_id, agent_id, permissions")
        .eq("client_id", clientId);

      const grouped: Record<string, AgentTemplate[]> = {};
      (templates || []).forEach((t: any) => {
        if (!grouped[t.role_id]) grouped[t.role_id] = [];
        const agentName = (assignments || []).find((a: any) => a.agents?.id === t.agent_id)?.agents?.name || "Unknown";
        grouped[t.role_id].push({
          agent_id: t.agent_id,
          agent_name: agentName,
          permissions: t.permissions || {},
        });
      });
      setRoleTemplates(grouped);

      const { data: uniquePerms } = await supabase
        .from("client_user_agent_permissions")
        .select("role_id, user_id")
        .eq("client_id", clientId);
      const uniqueCounts: Record<string, Set<string>> = {};
      (uniquePerms || []).forEach((r: any) => {
        if (r.role_id) {
          if (!uniqueCounts[r.role_id]) uniqueCounts[r.role_id] = new Set();
          uniqueCounts[r.role_id].add(r.user_id);
        }
      });
      const finalCounts: Record<string, number> = {};
      Object.entries(uniqueCounts).forEach(([roleId, users]) => {
        finalCounts[roleId] = users.size;
      });
      setUserCounts(finalCounts);
    } catch (error) {
      console.error("Error loading roles data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAgencyEnabled = (agentId: string, permKey: string): boolean => {
    const config = agentCeilings[agentId] || {};
    const ceilingKey = "client_" + permKey + "_enabled";
    return config[ceilingKey] !== false;
  };

  const isClientCapEnabled = (capKey: string): boolean => {
    return clientCaps[capKey] !== false;
  };

  const getVisiblePermKeys = (agentId: string) => {
    return AGENT_PERMISSION_KEYS.filter(p => isAgencyEnabled(agentId, p.key));
  };

  const getVisibleCompanyTabs = () => {
    return COMPANY_SETTINGS_TABS.filter(t => clientCaps[t.capKey] !== false);
  };

  const togglePermission = async (roleId: string, agentId: string, permKey: string, value: boolean) => {
    const templates = roleTemplates[roleId] || [];
    const template = templates.find(t => t.agent_id === agentId);
    if (!template) return;

    const previousPermissions = template.permissions;
    const updatedPermissions = { ...template.permissions, [permKey]: value };

    // Optimistic UI update
    setRoleTemplates(prev => ({
      ...prev,
      [roleId]: (prev[roleId] || []).map(t =>
        t.agent_id === agentId ? { ...t, permissions: updatedPermissions } : t
      ),
    }));

    const { error } = await supabase
      .from("role_permission_templates")
      .update({ permissions: updatedPermissions })
      .eq("role_id", roleId)
      .eq("agent_id", agentId)
      .eq("client_id", clientId);

    if (error) {
      // Roll back optimistic state and surface the failure
      setRoleTemplates(prev => ({
        ...prev,
        [roleId]: (prev[roleId] || []).map(t =>
          t.agent_id === agentId ? { ...t, permissions: previousPermissions } : t
        ),
      }));
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    }
  };

  const toggleClientPermissions = async (roleId: string, updates: Record<string, boolean>) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    const previousPerms = role.client_permissions;
    const updatedPerms = { ...role.client_permissions, ...updates };

    // Optimistic UI update
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, client_permissions: updatedPerms } : r));

    const { error } = await supabase
      .from("client_roles")
      .update({ client_permissions: updatedPerms })
      .eq("id", roleId);

    if (error) {
      // Roll back optimistic state
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, client_permissions: previousPerms } : r));
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveRole = (roleId: string, roleName: string) => {
    const count = userCounts[roleId] || 0;
    if (count > 0) {
      setApplyAllModal({ roleId, roleName });
    } else {
      toast({ title: "Saved", description: `Role "${roleName}" updated` });
    }
  };

  const applyToAllUsers = async (roleId: string) => {
    const templates = roleTemplates[roleId] || [];
    const errors: string[] = [];

    for (const template of templates) {
      const { error } = await supabase
        .from("client_user_agent_permissions")
        .update({ permissions: template.permissions })
        .eq("role_id", roleId)
        .eq("agent_id", template.agent_id)
        .eq("client_id", clientId)
        .eq("has_overrides", false);
      if (error) errors.push(`${template.agent_name || template.agent_id}: ${error.message}`);
    }

    setApplyAllModal(null);
    if (errors.length > 0) {
      toast({ title: "Apply finished with errors", description: errors.join('. '), variant: "destructive" });
    } else {
      toast({ title: "Applied", description: "All users with this role have been updated" });
    }
  };

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    const slug = newRoleName.trim().toLowerCase().replace(/\s+/g, "_");

    const { data: newRole, error } = await supabase
      .from("client_roles")
      .insert({
        client_id: clientId,
        name: newRoleName.trim(),
        slug,
        is_admin_tier: false,
        is_system: false,
        is_default: false,
        sort_order: roles.length,
        client_permissions: {
          settings_page: false,
          settings_departments_view: false, settings_departments_manage: false,
          settings_team_view: false, settings_team_manage: false,
          settings_canned_responses_view: false, settings_canned_responses_manage: false,
          settings_general_view: false, settings_general_manage: false,
          settings_audit_log_view: false,
        },
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const agentIds = Object.keys(agentCeilings);
    for (const agentId of agentIds) {
      await supabase.from("role_permission_templates").insert({
        client_id: clientId,
        agent_id: agentId,
        role_id: newRole.id,
        permissions: {
          conversations: false, transcripts: false, analytics: false,
          specs: false, knowledge_base: false, guides: false, agent_settings: false,
        },
      });
    }

    setNewRoleName("");
    setShowAddRole(false);
    loadData();
    toast({ title: "Created", description: `Role "${newRoleName.trim()}" created` });
  };

  const deleteRole = async (roleId: string) => {
    const count = userCounts[roleId] || 0;
    if (count > 0) {
      toast({ title: "Cannot delete", description: "Reassign users to another role first", variant: "destructive" });
      setDeleteRoleId(null);
      return;
    }

    await supabase.from("role_permission_templates").delete().eq("role_id", roleId).eq("client_id", clientId);
    await supabase.from("client_roles").delete().eq("id", roleId);

    setDeleteRoleId(null);
    loadData();
    toast({ title: "Deleted", description: "Role removed" });
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading roles...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Roles</h3>
          <p className="text-sm text-muted-foreground">Define what each role can access. New users are assigned a role when created.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddRole(true)}>
          <Plus className="h-4 w-4 mr-1" /> New role
        </Button>
      </div>

      {showAddRole && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
          <Input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="Role name, e.g. Viewer"
            className="flex-1"
            onKeyDown={e => e.key === "Enter" && addRole()}
          />
          <Button size="sm" onClick={addRole}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowAddRole(false); setNewRoleName(""); }}>Cancel</Button>
        </div>
      )}

      {roles.map(role => {
        const isExpanded = expandedRoleId === role.id;
        const templates = roleTemplates[role.id] || [];
        const count = userCounts[role.id] || 0;

        return (
          <div key={role.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {role.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{role.name}</span>
                    {role.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">system</span>
                    )}
                    {role.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">default</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {role.is_admin_tier ? "Full access to all agency-enabled features" : `${count} user${count !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!role.is_system && (
                  <button
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); setDeleteRoleId(role.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {role.is_admin_tier ? (
                  <>
                    <p className="text-sm text-muted-foreground">Admin role defaults to full access. You can customise what new Admin users receive by default.</p>
                    {templates.map(template => {
                      const visibleKeys = getVisiblePermKeys(template.agent_id);
                      if (visibleKeys.length === 0) return null;
                      return (
                        <div key={template.agent_id} className="space-y-2">
                          {templates.length > 1 && (
                            <h4 className="text-sm font-medium text-foreground">{template.agent_name}</h4>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {visibleKeys.map(p => (
                              <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={template.permissions[p.key] || false}
                                  onChange={e => togglePermission(role.id, template.agent_id, p.key, e.target.checked)}
                                  className="rounded border-input"
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {clientCaps['settings_page_enabled'] !== false && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-primary"
                              checked={role.client_permissions?.settings_page || false}
                              onChange={e => toggleClientPermissions(role.id, { settings_page: e.target.checked })}
                            />
                            Company settings
                          </label>
                          {role.client_permissions?.settings_page && (
                            <div className="flex gap-2 items-center">
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updates: Record<string, boolean> = {};
                                  getVisibleCompanyTabs().forEach(t => {
                                    updates[t.key + '_view'] = true;
                                  });
                                  toggleClientPermissions(role.id, updates);
                                }}
                              >
                                view all
                              </button>
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updates: Record<string, boolean> = {};
                                  getVisibleCompanyTabs().forEach(t => {
                                    if (!(t as any).viewOnly) {
                                      updates[t.key + '_view'] = true;
                                      updates[t.key + '_manage'] = true;
                                    }
                                  });
                                  toggleClientPermissions(role.id, updates);
                                }}
                              >
                                manage all
                              </button>
                              <span className="text-[11px] text-muted-foreground">view / manage</span>
                            </div>
                          )}
                        </div>
                        {role.client_permissions?.settings_page && (
                          <div className="space-y-1.5 pl-6">
                            {getVisibleCompanyTabs().map(tab => (
                              <div key={tab.key} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md">
                                <span className="text-sm">{tab.label}</span>
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 rounded accent-primary"
                                      checked={role.client_permissions?.[tab.key + '_view'] || false}
                                      onChange={e => {
                                        const updates: Record<string, boolean> = { [tab.key + '_view']: e.target.checked };
                                        if (!e.target.checked) {
                                          updates[tab.key + '_manage'] = false;
                                        }
                                        toggleClientPermissions(role.id, updates);
                                      }}
                                    />
                                    view
                                  </label>
                                  {(tab as any).viewOnly ? (
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                                      <input type="checkbox" className="w-3.5 h-3.5 rounded opacity-30" disabled />
                                      manage
                                    </label>
                                  ) : (
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded accent-primary"
                                        checked={role.client_permissions?.[tab.key + '_manage'] || false}
                                        onChange={e => {
                                          const updates: Record<string, boolean> = { [tab.key + '_manage']: e.target.checked };
                                          if (e.target.checked) {
                                            updates[tab.key + '_view'] = true;
                                          }
                                          toggleClientPermissions(role.id, updates);
                                        }}
                                      />
                                      manage
                                    </label>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* F16 fix: Save only does something useful when the role
                        has users (it opens the "Apply to all users" modal).
                        When count is 0, every toggle already persisted on
                        change — Save was a no-op that just toasted "Saved" and
                        confused admins into thinking it was required. Hide it. */}
                    {(userCounts[role.id] || 0) > 0 && (
                      <div className="flex justify-end pt-2">
                        <Button size="sm" onClick={() => handleSaveRole(role.id, role.name)}>
                          Apply to {userCounts[role.id]} {userCounts[role.id] === 1 ? 'user' : 'users'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Toggle which pages users with this role can access.</p>
                    {templates.map(template => {
                      const visibleKeys = getVisiblePermKeys(template.agent_id);
                      if (visibleKeys.length === 0) return null;
                      return (
                        <div key={template.agent_id} className="space-y-2">
                          {templates.length > 1 && (
                            <h4 className="text-sm font-medium text-foreground">{template.agent_name}</h4>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {visibleKeys.map(p => (
                              <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={template.permissions[p.key] || false}
                                  onChange={e => togglePermission(role.id, template.agent_id, p.key, e.target.checked)}
                                  className="rounded border-input"
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {clientCaps['settings_page_enabled'] !== false && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-primary"
                              checked={role.client_permissions?.settings_page || false}
                              onChange={e => toggleClientPermissions(role.id, { settings_page: e.target.checked })}
                            />
                            Company settings
                          </label>
                          {role.client_permissions?.settings_page && (
                            <div className="flex gap-2 items-center">
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updates: Record<string, boolean> = {};
                                  getVisibleCompanyTabs().forEach(t => {
                                    updates[t.key + '_view'] = true;
                                  });
                                  toggleClientPermissions(role.id, updates);
                                }}
                              >
                                view all
                              </button>
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updates: Record<string, boolean> = {};
                                  getVisibleCompanyTabs().forEach(t => {
                                    if (!(t as any).viewOnly) {
                                      updates[t.key + '_view'] = true;
                                      updates[t.key + '_manage'] = true;
                                    }
                                  });
                                  toggleClientPermissions(role.id, updates);
                                }}
                              >
                                manage all
                              </button>
                              <span className="text-[11px] text-muted-foreground">view / manage</span>
                            </div>
                          )}
                        </div>
                        {role.client_permissions?.settings_page && (
                          <div className="space-y-1.5 pl-6">
                            {getVisibleCompanyTabs().map(tab => (
                              <div key={tab.key} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md">
                                <span className="text-sm">{tab.label}</span>
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 rounded accent-primary"
                                      checked={role.client_permissions?.[tab.key + '_view'] || false}
                                      onChange={e => {
                                        const updates: Record<string, boolean> = { [tab.key + '_view']: e.target.checked };
                                        if (!e.target.checked) {
                                          updates[tab.key + '_manage'] = false;
                                        }
                                        toggleClientPermissions(role.id, updates);
                                      }}
                                    />
                                    view
                                  </label>
                                  {(tab as any).viewOnly ? (
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                                      <input type="checkbox" className="w-3.5 h-3.5 rounded opacity-30" disabled />
                                      manage
                                    </label>
                                  ) : (
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded accent-primary"
                                        checked={role.client_permissions?.[tab.key + '_manage'] || false}
                                        onChange={e => {
                                          const updates: Record<string, boolean> = { [tab.key + '_manage']: e.target.checked };
                                          if (e.target.checked) {
                                            updates[tab.key + '_view'] = true;
                                          }
                                          toggleClientPermissions(role.id, updates);
                                        }}
                                      />
                                      manage
                                    </label>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* F16 fix: Save only does something useful when the role
                        has users (it opens the "Apply to all users" modal).
                        When count is 0, every toggle already persisted on
                        change — Save was a no-op that just toasted "Saved" and
                        confused admins into thinking it was required. Hide it. */}
                    {(userCounts[role.id] || 0) > 0 && (
                      <div className="flex justify-end pt-2">
                        <Button size="sm" onClick={() => handleSaveRole(role.id, role.name)}>
                          Apply to {userCounts[role.id]} {userCounts[role.id] === 1 ? 'user' : 'users'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">Only pages enabled by your agency are shown.</p>

      <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This cannot be undone.
              {(userCounts[deleteRoleId || ""] || 0) > 0 &&
                " This role has users assigned — reassign them first."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRoleId && deleteRole(deleteRoleId)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={(userCounts[deleteRoleId || ""] || 0) > 0}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!applyAllModal} onOpenChange={() => setApplyAllModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes to all {applyAllModal?.roleName}s?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {userCounts[applyAllModal?.roleId || ""] || 0} users.
              Users with personal overrides will keep their overrides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              toast({ title: "Saved", description: "Role updated (new users only)" });
              setApplyAllModal(null);
            }}>
              Save role only
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => applyAllModal && applyToAllUsers(applyAllModal.roleId)}>
              Apply to all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
