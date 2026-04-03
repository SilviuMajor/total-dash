import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useAuth } from "@/hooks/useAuth";
import { X, Search, Building2, Users, ChevronRight, Clock, Eye } from "lucide-react";
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
  const { isImpersonating, activeSession, startImpersonation, endImpersonation } = useImpersonation();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "agencies" | "clients">("all");
  const [agencies, setAgencies] = useState<AgencyItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [usersByClient, setUsersByClient] = useState<Record<string, UserItem[]>>({});
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
      loadData();
      setSearch("");
      setFilter("all");
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

  // Smart context: pre-expand client from URL
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

      const { data: clientData } = await supabase
        .from("clients")
        .select("id, name, agency_id, agencies(name)")
        .is("deleted_at", null)
        .order("name");

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

  const searchMatchedUsers: (UserItem & { fromSearch: true })[] = [];
  if (search) {
    Object.values(usersByClient).flat().forEach((u) => {
      if (u.full_name.toLowerCase().includes(searchLower)) {
        searchMatchedUsers.push({ ...u, fromSearch: true });
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
    window.location.href = "/admin/agencies";
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getSessionLabel = (s: RecentSession) => {
    if (s.target_type === "agency") return s.agency_name || "Agency";
    if (s.target_user_name) return s.target_user_name;
    return s.client_name || "Client";
  };

  const showAgencies = filter === "all" || filter === "agencies";
  const showClients = filter === "all" || filter === "clients";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-background rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[75vh]">

        {/* Header */}
        <div className="p-4 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Impersonate</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current session */}
          {isImpersonating && activeSession && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {activeSession.target_type === "agency"
                    ? "Agency dashboard"
                    : activeSession.target_user_name
                    ? `Viewing as ${activeSession.target_user_name}`
                    : "Full access"}
                </span>
              </div>
              <button onClick={handleEndCurrent} className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors font-medium">
                End
              </button>
            </div>
          )}

          {/* Recent sessions — condensed pills */}
          {!search && recentSessions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              {recentSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleReEnter(s)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted-foreground/10 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  {getSessionLabel(s)}
                  <span className="text-[10px] opacity-60">{formatTimeAgo(s.ended_at)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchRef}
              placeholder="Search agencies, clients, users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5">
            {(["all", "agencies", "clients"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelectedAgencyId(null); }}
                className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto border-t border-border">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="py-1">

              {/* Search-matched users */}
              {search && searchMatchedUsers.length > 0 && (
                <>
                  <div className="px-4 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Users</p>
                  </div>
                  {searchMatchedUsers.map((u) => (
                    <div key={`search-${u.id}`} className="flex items-center gap-3 px-5 py-2 hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          {u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.client_name} · {u.role_name}</p>
                      </div>
                      <button
                        onClick={() => handleViewAsUser(u)}
                        className="text-[10px] px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors flex-shrink-0"
                      >
                        View as
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Agencies */}
              {showAgencies && filteredAgencies.length > 0 && (
                <>
                  <div className="px-4 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Agencies</p>
                  </div>
                  {filteredAgencies.map((agency) => (
                    <div
                      key={agency.id}
                      className="flex items-center gap-3 px-5 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedAgencyId(selectedAgencyId === agency.id ? null : agency.id);
                        setExpandedClientId(null);
                      }}
                    >
                      <div className="flex-shrink-0">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{agency.name}</p>
                        <p className="text-[11px] text-muted-foreground">{agency.client_count} client{agency.client_count !== 1 ? "s" : ""}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewAgency(agency); }}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors flex-shrink-0"
                      >
                        View as agency
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Clients — folder-style with expandable users */}
              {showClients && filteredClients.length > 0 && (
                <>
                  <div className="px-4 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Clients{selectedAgencyId ? ` · ${agencies.find((a) => a.id === selectedAgencyId)?.name}` : ""}
                    </p>
                  </div>
                  {filteredClients.map((client) => {
                    const isExpanded = expandedClientId === client.id;
                    const clientUsersList = usersByClient[client.id] || [];
                    const isLoadingThisClient = loadingUsers === client.id;

                    return (
                      <div key={client.id}>
                        {/* Client row */}
                        <div
                          className="flex items-center gap-3 px-5 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => toggleClient(client.id)}
                        >
                          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                          <div className="flex-shrink-0">
                            <Users className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                            <p className="text-[11px] text-muted-foreground">{client.agency_name} · {client.user_count} user{client.user_count !== 1 ? "s" : ""}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFullAccess(client); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors flex-shrink-0"
                          >
                            Full access
                          </button>
                        </div>

                        {/* Expanded users */}
                        {isExpanded && (
                          <div className="bg-muted/30 border-y border-border">
                            {isLoadingThisClient ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : clientUsersList.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                            ) : (
                              clientUsersList.map((u) => (
                                <div key={u.id} className="flex items-center gap-3 pl-12 pr-5 py-1.5 hover:bg-muted/50 transition-colors">
                                  <div className="flex-shrink-0">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                      {u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{u.full_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{u.role_name}{u.department_name ? ` · ${u.department_name}` : ""}</p>
                                  </div>
                                  <button
                                    onClick={() => handleViewAsUser(u)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors flex-shrink-0"
                                  >
                                    View as
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

              {/* Empty state */}
              {!loadingData && filteredAgencies.length === 0 && filteredClients.length === 0 && searchMatchedUsers.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}