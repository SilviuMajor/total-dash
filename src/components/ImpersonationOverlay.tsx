import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useAuth } from "@/hooks/useAuth";
import { X, Search, Building2, Users, User, ChevronRight, Clock, Eye } from "lucide-react";
import { useLocation } from "react-router-dom";

interface AgencyItem {
  id: string;
  name: string;
  slug: string;
  client_count: number;
}

interface ClientItem {
  id: string;
  name: string;
  agency_id: string;
  agency_name: string;
  user_count: number;
}

interface UserItem {
  id: string;
  user_id: string;
  full_name: string;
  role_name: string;
  department_name: string | null;
  client_id: string;
  client_name: string;
}

interface RecentSession {
  id: string;
  target_type: string;
  target_user_name: string | null;
  agency_id: string | null;
  client_id: string | null;
  mode: string;
  started_at: string;
  ended_at: string;
  agency_name?: string;
  client_name?: string;
}

interface ImpersonationOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ImpersonationOverlay({ open, onClose }: ImpersonationOverlayProps) {
  const { user } = useAuth();
  const { userType } = useMultiTenantAuth();
  const { isImpersonating, activeSession, startImpersonation, endImpersonation } = useImpersonation();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [agencies, setAgencies] = useState<AgencyItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [usersByClient, setUsersByClient] = useState<Record<string, UserItem[]>>({});
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isAgencyUser = userType === 'agency';

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 150);
      loadData();
      setSearch("");
      setSelectedAgencyId(null);
      setExpandedClientId(null);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const match = location.pathname.match(/\/agency\/clients\/([^/]+)/);
      if (match) {
        setExpandedClientId(match[1]);
        loadUsersForClient(match[1]);
      }
    }
  }, [open, location.pathname]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      if (!isAgencyUser) {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id, name, slug")
          .eq("is_active", true)
          .order("name");

        if (agencyData) {
          const { data: clientCounts } = await supabase
            .from("clients")
            .select("agency_id")
            .is("deleted_at", null);

          const countMap: Record<string, number> = {};
          (clientCounts || []).forEach((c: any) => {
            countMap[c.agency_id] = (countMap[c.agency_id] || 0) + 1;
          });

          setAgencies(
            agencyData.map((a: any) => ({
              id: a.id, name: a.name, slug: a.slug,
              client_count: countMap[a.id] || 0,
            }))
          );
        }
      }

      let clientQuery = supabase
        .from("clients")
        .select("id, name, agency_id, agencies(name)")
        .is("deleted_at", null)
        .order("name");

      const { data: clientData } = await clientQuery;

      if (clientData) {
        const { data: userCounts } = await supabase
          .from("client_users")
          .select("client_id");

        const userCountMap: Record<string, number> = {};
        (userCounts || []).forEach((u: any) => {
          userCountMap[u.client_id] = (userCountMap[u.client_id] || 0) + 1;
        });

        setClients(
          clientData.map((c: any) => ({
            id: c.id, name: c.name, agency_id: c.agency_id,
            agency_name: (c.agencies as any)?.name || "Unknown",
            user_count: userCountMap[c.id] || 0,
          }))
        );
      }

      if (user) {
        const { data: sessionData } = await supabase
          .from("impersonation_sessions")
          .select("id, target_type, target_user_name, agency_id, client_id, mode, started_at, ended_at")
          .eq("actor_id", user.id)
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(3);

        if (sessionData) {
          const agencyIds = [...new Set(sessionData.map((s: any) => s.agency_id).filter(Boolean))];
          const clientIds = [...new Set(sessionData.map((s: any) => s.client_id).filter(Boolean))];

          let agencyNames: Record<string, string> = {};
          let clientNames: Record<string, string> = {};

          if (agencyIds.length > 0) {
            const { data: an } = await supabase.from("agencies").select("id, name").in("id", agencyIds);
            (an || []).forEach((a: any) => { agencyNames[a.id] = a.name; });
          }
          if (clientIds.length > 0) {
            const { data: cn } = await supabase.from("clients").select("id, name").in("id", clientIds);
            (cn || []).forEach((c: any) => { clientNames[c.id] = c.name; });
          }

          setRecentSessions(
            sessionData.map((s: any) => ({
              ...s,
              agency_name: s.agency_id ? agencyNames[s.agency_id] : undefined,
              client_name: s.client_id ? clientNames[s.client_id] : undefined,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Error loading impersonation data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadUsersForClient = useCallback(async (clientId: string) => {
    if (usersByClient[clientId]) return;
    setLoadingUsers(clientId);
    try {
      const { data } = await supabase
        .from("client_users")
        .select("id, user_id, full_name, client_id")
        .eq("client_id", clientId);

      if (!data) return;

      const userIds = data.map((u: any) => u.user_id);
      let roleMap: Record<string, string> = {};
      let deptMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: perms } = await supabase
          .from("client_user_agent_permissions")
          .select("user_id, role_id")
          .in("user_id", userIds)
          .eq("client_id", clientId);

        const roleIds = [...new Set((perms || []).map((p: any) => p.role_id).filter(Boolean))];
        if (roleIds.length > 0) {
          const { data: roles } = await supabase.from("client_roles").select("id, name").in("id", roleIds);
          const roleNameMap: Record<string, string> = {};
          (roles || []).forEach((r: any) => { roleNameMap[r.id] = r.name; });
          (perms || []).forEach((p: any) => {
            if (p.role_id && roleNameMap[p.role_id]) roleMap[p.user_id] = roleNameMap[p.role_id];
          });
        }

        const { data: cuData } = await supabase
          .from("client_users")
          .select("user_id, departments(name)")
          .in("user_id", userIds)
          .eq("client_id", clientId);
        (cuData || []).forEach((cu: any) => {
          if (cu.departments?.name) deptMap[cu.user_id] = cu.departments.name;
        });
      }

      const client = clients.find((c) => c.id === clientId);
      const users = data.map((u: any) => ({
        id: u.id, user_id: u.user_id,
        full_name: u.full_name || "Unnamed",
        role_name: roleMap[u.user_id] || "Unknown",
        department_name: deptMap[u.user_id] || null,
        client_id: clientId,
        client_name: client?.name || "Unknown",
      }));

      setUsersByClient((prev) => ({ ...prev, [clientId]: users }));
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(null);
    }
  }, [clients, usersByClient]);

  const toggleClient = (clientId: string) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
    } else {
      setExpandedClientId(clientId);
      loadUsersForClient(clientId);
    }
  };

  const searchLower = search.toLowerCase();
  const filteredAgencies = agencies.filter(
    (a) => !search || a.name.toLowerCase().includes(searchLower)
  );
  const filteredClients = clients.filter((c) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(searchLower) || c.agency_name.toLowerCase().includes(searchLower);
    const matchesAgency = !selectedAgencyId || c.agency_id === selectedAgencyId;
    return matchesSearch && matchesAgency;
  });

  const searchMatchedUsers: UserItem[] = [];
  if (search) {
    Object.values(usersByClient).flat().forEach((u) => {
      if (u.full_name.toLowerCase().includes(searchLower)) {
        searchMatchedUsers.push(u);
      }
    });
  }

  const handleViewAgency = async (agency: AgencyItem) => {
    try {
      await startImpersonation({ targetType: "agency", agencyId: agency.id });
      onClose();
      window.location.href = "/agency/clients";
    } catch (e: any) { console.error(e); }
  };

  const handleFullAccess = async (client: ClientItem) => {
    try {
      await startImpersonation({ targetType: "client_full", clientId: client.id, agencyId: client.agency_id });
      onClose();
      window.location.href = "/";
    } catch (e: any) { console.error(e); }
  };

  const handleViewAsUser = async (u: UserItem) => {
    try {
      const client = clients.find((c) => c.id === u.client_id);
      await startImpersonation({ targetType: "client_user", targetUserId: u.user_id, clientId: u.client_id, agencyId: client?.agency_id });
      onClose();
      window.location.href = "/";
    } catch (e: any) { console.error(e); }
  };

  const handleReEnter = async (session: RecentSession) => {
    try {
      if (session.target_type === "agency" && session.agency_id) {
        await startImpersonation({ targetType: "agency", agencyId: session.agency_id });
        onClose();
        window.location.href = "/agency/clients";
      } else if (session.client_id) {
        const client = clients.find((c) => c.id === session.client_id);
        await startImpersonation({ targetType: session.target_type, clientId: session.client_id, agencyId: session.agency_id || client?.agency_id || undefined });
        onClose();
        window.location.href = "/";
      }
    } catch (e: any) { console.error(e); }
  };

  const handleEndCurrent = async () => {
    await endImpersonation();
    onClose();
    if (isAgencyUser) {
      window.location.href = "/agency/clients";
    } else {
      window.location.href = "/admin/agencies";
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const getSessionLabel = (s: RecentSession) => {
    if (s.target_type === "agency") return s.agency_name || "Agency";
    if (s.target_user_name) return s.target_user_name;
    return s.client_name || "Client";
  };

  const getSessionColor = (s: RecentSession) => {
    if (s.target_type === "agency") return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";
    if (s.target_user_name) return "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300";
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — dims the page */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel — slides up inside the sidebar column */}
      <div
        ref={panelRef}
        className="fixed left-0 w-[240px] bg-background border-r border-t border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-bottom-4 duration-200"
        style={{ bottom: '120px', maxHeight: 'calc(100vh - 180px)' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px] font-semibold">
                {isAgencyUser ? 'Preview client' : 'Impersonate'}
              </span>
            </div>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current session */}
          {isImpersonating && activeSession && (() => {
            const isAgency = activeSession.target_type === 'agency';
            const isUser = activeSession.mode === 'view_as_user';
            const sessionColors = isAgency
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : isUser
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
            const textColor = isAgency ? 'text-red-700 dark:text-red-300' : isUser ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300';
            const subColor = isAgency ? 'text-red-600 dark:text-red-400' : isUser ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';
            const TypeIcon = isAgency ? Building2 : isUser ? User : Users;

            const elapsed = (() => {
              const mins = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 60000);
              if (mins < 1) return '< 1m';
              if (mins < 60) return `${mins}m`;
              return `${Math.floor(mins / 60)}h ${mins % 60}m`;
            })();

            return (
              <div className={`px-2.5 py-2 rounded-md border ${sessionColors}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse flex-shrink-0" style={{ color: isAgency ? '#A32D2D' : isUser ? '#3B6D11' : '#185FA5' }} />
                    <span className={`text-[11px] font-medium truncate ${textColor}`}>
                      {isAgency ? 'Agency view' : isUser ? 'View as user' : 'Client full access'}
                    </span>
                  </div>
                  <span className={`text-[9px] ${subColor}`}>{elapsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 min-w-0">
                    <TypeIcon className={`w-3 h-3 flex-shrink-0 ${subColor}`} />
                    <span className={`text-[10px] font-medium truncate ${textColor}`}>
                      {isAgency
                        ? (activeSession.agency_id ? 'Loading...' : 'Agency')
                        : isUser
                        ? (activeSession.target_user_name || 'User')
                        : 'Client'}
                    </span>
                  </div>
                  <button
                    onClick={handleEndCurrent}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors flex-shrink-0"
                  >
                    End
                  </button>
                </div>
                <div className={`text-[9px] mt-1 ${subColor} opacity-70`}>
                  {isUser ? 'read-only' : 'full access'} · {elapsed}
                </div>
              </div>
            );
          })()}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[12px] bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">

              {/* Recent sessions — only when searching */}
              {search && recentSessions.length > 0 && (
                <>
                  <div className="px-1.5 pt-1.5 pb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                  </div>
                  <div className="flex flex-wrap gap-1 px-1.5">
                    {recentSessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleReEnter(s)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors hover:opacity-80 ${getSessionColor(s)}`}
                      >
                        {getSessionLabel(s)}
                        <span className="opacity-60">{formatTimeAgo(s.ended_at)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Search-matched users */}
              {search && searchMatchedUsers.length > 0 && (
                <>
                  <div className="px-1.5 pt-1.5 pb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Users</span>
                  </div>
                  {searchMatchedUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-muted/50 group">
                      <div className="flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-[8px] font-medium text-green-700 dark:text-green-300">
                          {u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{u.full_name}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{u.client_name} · {u.role_name}</p>
                      </div>
                      <button
                        onClick={() => handleViewAsUser(u)}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors flex-shrink-0"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Agencies — super admin only */}
              {!isAgencyUser && filteredAgencies.length > 0 && (
                <>
                  <div className="px-1.5 pt-1.5 pb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agencies</span>
                  </div>
                  {filteredAgencies.map((agency) => (
                    <div
                      key={agency.id}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer group"
                      onClick={() => {
                        setSelectedAgencyId(selectedAgencyId === agency.id ? null : agency.id);
                        setExpandedClientId(null);
                      }}
                    >
                      <div className="flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[11px] font-medium truncate flex-1">{agency.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewAgency(agency); }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex-shrink-0"
                      >
                        Enter
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Clients */}
              {filteredClients.length > 0 && (
                <>
                  <div className="px-1.5 pt-1.5 pb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {isAgencyUser ? "Your clients" : `Clients${selectedAgencyId ? ` · ${agencies.find((a) => a.id === selectedAgencyId)?.name}` : ""}`}
                    </span>
                  </div>
                  {filteredClients.map((client) => {
                    const isExpanded = expandedClientId === client.id;
                    const clientUsers = usersByClient[client.id] || [];
                    const isLoadingThisClient = loadingUsers === client.id;

                    return (
                      <div key={client.id}>
                        <div
                          className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer group"
                          onClick={() => toggleClient(client.id)}
                        >
                          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                          <div className="flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{client.name}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFullAccess(client); }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors flex-shrink-0"
                          >
                            Full
                          </button>
                        </div>

                        {/* Expanded users */}
                        {isExpanded && (
                          <div className="ml-4 border-l border-border pl-1.5 mt-0.5 space-y-0.5">
                            {isLoadingThisClient ? (
                              <div className="flex items-center justify-center py-2">
                                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : clientUsers.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground px-1.5 py-1">No users</p>
                            ) : (
                              clientUsers.map((u) => (
                                <div key={u.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-muted/50 group">
                                  <div className="flex-shrink-0">
                                    <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-[7px] font-medium text-green-700 dark:text-green-300">
                                      {u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-medium truncate">{u.full_name}</p>
                                    <p className="text-[8px] text-muted-foreground truncate">{u.role_name}</p>
                                  </div>
                                  <button
                                    onClick={() => handleViewAsUser(u)}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors flex-shrink-0"
                                  >
                                    View
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Empty */}
              {!loadingData && filteredAgencies.length === 0 && filteredClients.length === 0 && searchMatchedUsers.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No results</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
