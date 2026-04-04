import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useAuth } from "@/hooks/useAuth";
import { Search, Building2, Users, User, ChevronRight, Clock } from "lucide-react";
import { useLocation } from "react-router-dom";

interface AgencyItem { id: string; name: string; slug: string; client_count: number; }
interface ClientItem { id: string; name: string; agency_id: string; agency_name: string; user_count: number; }
interface UserItem { id: string; user_id: string; full_name: string; role_name: string; department_name: string | null; client_id: string; client_name: string; }
interface RecentSession { id: string; target_type: string; target_user_name: string | null; agency_id: string | null; client_id: string | null; mode: string; started_at: string; ended_at: string; agency_name?: string; client_name?: string; }

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
        const { data: agencyData } = await supabase.from("agencies").select("id, name, slug").eq("is_active", true).order("name");
        if (agencyData) {
          const { data: clientCounts } = await supabase.from("clients").select("agency_id").is("deleted_at", null);
          const countMap: Record<string, number> = {};
          (clientCounts || []).forEach((c: any) => { countMap[c.agency_id] = (countMap[c.agency_id] || 0) + 1; });
          setAgencies(agencyData.map((a: any) => ({ id: a.id, name: a.name, slug: a.slug, client_count: countMap[a.id] || 0 })));
        }
      }

      const { data: clientData } = await supabase.from("clients").select("id, name, agency_id, agencies(name)").is("deleted_at", null).order("name");
      if (clientData) {
        const { data: userCounts } = await supabase.from("client_users").select("client_id");
        const userCountMap: Record<string, number> = {};
        (userCounts || []).forEach((u: any) => { userCountMap[u.client_id] = (userCountMap[u.client_id] || 0) + 1; });
        setClients(clientData.map((c: any) => ({ id: c.id, name: c.name, agency_id: c.agency_id, agency_name: (c.agencies as any)?.name || "Unknown", user_count: userCountMap[c.id] || 0 })));
      }

      if (user) {
        const { data: sessionData } = await supabase.from("impersonation_sessions").select("id, target_type, target_user_name, agency_id, client_id, mode, started_at, ended_at").eq("actor_id", user.id).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(3);
        if (sessionData) {
          const agencyIds = [...new Set(sessionData.map((s: any) => s.agency_id).filter(Boolean))];
          const clientIds = [...new Set(sessionData.map((s: any) => s.client_id).filter(Boolean))];
          let agencyNames: Record<string, string> = {}; let clientNames: Record<string, string> = {};
          if (agencyIds.length > 0) { const { data: an } = await supabase.from("agencies").select("id, name").in("id", agencyIds); (an || []).forEach((a: any) => { agencyNames[a.id] = a.name; }); }
          if (clientIds.length > 0) { const { data: cn } = await supabase.from("clients").select("id, name").in("id", clientIds); (cn || []).forEach((c: any) => { clientNames[c.id] = c.name; }); }
          setRecentSessions(sessionData.map((s: any) => ({ ...s, agency_name: s.agency_id ? agencyNames[s.agency_id] : undefined, client_name: s.client_id ? clientNames[s.client_id] : undefined })));
        }
      }
    } catch (error) { console.error("Error loading impersonation data:", error); }
    finally { setLoadingData(false); }
  };

  const loadUsersForClient = useCallback(async (clientId: string) => {
    if (usersByClient[clientId]) return;
    setLoadingUsers(clientId);
    try {
      const { data } = await supabase.from("client_users").select("id, user_id, full_name, client_id").eq("client_id", clientId);
      if (!data) return;
      const userIds = data.map((u: any) => u.user_id);
      let roleMap: Record<string, string> = {}; let deptMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: perms } = await supabase.from("client_user_agent_permissions").select("user_id, role_id").in("user_id", userIds).eq("client_id", clientId);
        const roleIds = [...new Set((perms || []).map((p: any) => p.role_id).filter(Boolean))];
        if (roleIds.length > 0) { const { data: roles } = await supabase.from("client_roles").select("id, name").in("id", roleIds); const rn: Record<string, string> = {}; (roles || []).forEach((r: any) => { rn[r.id] = r.name; }); (perms || []).forEach((p: any) => { if (p.role_id && rn[p.role_id]) roleMap[p.user_id] = rn[p.role_id]; }); }
        const { data: cuData } = await supabase.from("client_users").select("user_id, departments(name)").in("user_id", userIds).eq("client_id", clientId);
        (cuData || []).forEach((cu: any) => { if (cu.departments?.name) deptMap[cu.user_id] = cu.departments.name; });
      }
      const client = clients.find((c) => c.id === clientId);
      setUsersByClient((prev) => ({ ...prev, [clientId]: data.map((u: any) => ({ id: u.id, user_id: u.user_id, full_name: u.full_name || "Unnamed", role_name: roleMap[u.user_id] || "Unknown", department_name: deptMap[u.user_id] || null, client_id: clientId, client_name: client?.name || "Unknown" })) }));
    } catch (error) { console.error("Error loading users:", error); }
    finally { setLoadingUsers(null); }
  }, [clients, usersByClient]);

  const toggleClient = (clientId: string) => {
    if (expandedClientId === clientId) { setExpandedClientId(null); }
    else { setExpandedClientId(clientId); loadUsersForClient(clientId); }
  };

  const searchLower = search.toLowerCase();
  const filteredAgencies = agencies.filter((a) => !search || a.name.toLowerCase().includes(searchLower));
  const filteredClients = clients.filter((c) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(searchLower) || c.agency_name.toLowerCase().includes(searchLower);
    const matchesAgency = !selectedAgencyId || c.agency_id === selectedAgencyId;
    return matchesSearch && matchesAgency;
  });
  const searchMatchedUsers: UserItem[] = [];
  if (search) { Object.values(usersByClient).flat().forEach((u) => { if (u.full_name.toLowerCase().includes(searchLower)) searchMatchedUsers.push(u); }); }

  const handleViewAgency = async (agency: AgencyItem) => {
    try { await startImpersonation({ targetType: "agency", agencyId: agency.id, agencyName: agency.name }); onClose(); window.location.href = "/agency/clients"; }
    catch (e: any) { console.error(e); alert('Failed to enter agency: ' + (e.message || 'Unknown error')); }
  };
  const handleFullAccess = async (client: ClientItem) => {
    try { await startImpersonation({ targetType: "client_full", clientId: client.id, agencyId: client.agency_id }); onClose(); window.location.href = "/"; }
    catch (e: any) { console.error(e); alert('Failed to enter client: ' + (e.message || 'Unknown error')); }
  };
  const handleViewAsUser = async (u: UserItem) => {
    try { const client = clients.find((c) => c.id === u.client_id); await startImpersonation({ targetType: "client_user", targetUserId: u.user_id, clientId: u.client_id, agencyId: client?.agency_id }); onClose(); window.location.href = "/"; }
    catch (e: any) { console.error(e); alert('Failed to view as user: ' + (e.message || 'Unknown error')); }
  };
  const handleReEnter = async (session: RecentSession) => {
    try {
      if (session.target_type === "agency" && session.agency_id) { await startImpersonation({ targetType: "agency", agencyId: session.agency_id }); onClose(); window.location.href = "/agency/clients"; }
      else if (session.client_id) { await startImpersonation({ targetType: session.target_type, clientId: session.client_id, agencyId: session.agency_id || undefined }); onClose(); window.location.href = "/"; }
    } catch (e: any) { console.error(e); }
  };
  const handleEndCurrent = async () => { await endImpersonation(); onClose(); if (isAgencyUser) window.location.href = "/agency/clients"; else window.location.href = "/admin/agencies"; };

  const formatTimeAgo = (dateStr: string) => { const d = Date.now() - new Date(dateStr).getTime(); const m = Math.floor(d / 60000); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
  const getSessionLabel = (s: RecentSession) => { if (s.target_type === "agency") return s.agency_name || "Agency"; if (s.target_user_name) return s.target_user_name; return s.client_name || "Client"; };
  const getSessionColor = (s: RecentSession) => { if (s.target_type === "agency") return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"; if (s.target_user_name) return "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"; return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"; };

  if (!open) return null;

  return (
    <>
      {/* Current session details when active */}
      {isImpersonating && activeSession && (() => {
        const isAgency = activeSession.target_type === 'agency';
        const isUser = activeSession.mode === 'view_as_user';
        const sc = isAgency ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/50' : isUser ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50' : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50';
        const tc = isAgency ? 'text-red-700 dark:text-red-300' : isUser ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300';
        const TypeIcon = isAgency ? Building2 : isUser ? User : Users;
        const elapsed = (() => { const mins = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 60000); if (mins < 1) return '< 1m'; if (mins < 60) return `${mins}m`; return `${Math.floor(mins / 60)}h ${mins % 60}m`; })();
        return (
          <div className={`mx-1.5 mb-2 px-2.5 py-2 rounded-md border ${sc}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse flex-shrink-0" style={{ color: isAgency ? '#A32D2D' : isUser ? '#3B6D11' : '#185FA5' }} />
                <span className={`text-[11px] font-medium truncate ${tc}`}>
                  {isAgency ? 'Agency view' : isUser ? 'View as user' : 'Client full access'}
                </span>
              </div>
              <span className={`text-[9px] ${tc} opacity-70`}>{elapsed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <TypeIcon className={`w-3 h-3 flex-shrink-0 ${tc}`} />
                <span className={`text-[10px] font-medium truncate ${tc}`}>
                  {isAgency ? 'Agency' : isUser ? (activeSession.target_user_name || 'User') : 'Client'}
                </span>
              </div>
              <button
                onClick={handleEndCurrent}
                className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors flex-shrink-0"
              >
                End
              </button>
            </div>
            <div className={`text-[9px] mt-1 ${tc} opacity-60`}>
              {isUser ? 'read-only' : 'full access'} · {elapsed}
            </div>
          </div>
        );
      })()}

      {/* Search */}
      <div className="px-2.5 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {loadingData ? (
          <div className="flex items-center justify-center py-6"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {/* Recent — only when searching */}
            {search && recentSessions.length > 0 && (
              <>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5">Recent</p>
                <div className="flex flex-wrap gap-1 px-1.5">
                  {recentSessions.map((s) => (<button key={s.id} onClick={() => handleReEnter(s)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:opacity-80 ${getSessionColor(s)}`}><span className="truncate max-w-[80px]">{getSessionLabel(s)}</span><span className="opacity-50">{formatTimeAgo(s.ended_at)}</span></button>))}
                </div>
              </>
            )}
            {/* Search-matched users */}
            {search && searchMatchedUsers.length > 0 && (
              <>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5">Users</p>
                {searchMatchedUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-1.5 py-1 hover:bg-muted/50 rounded-md transition-colors">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center flex-shrink-0"><span className="text-[8px] font-bold text-green-700 dark:text-green-300">{u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}</span></div>
                    <div className="min-w-0 flex-1"><p className="text-[11px] font-medium truncate">{u.full_name}</p><p className="text-[9px] text-muted-foreground truncate">{u.client_name}</p></div>
                    <button onClick={() => handleViewAsUser(u)} className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 transition-colors flex-shrink-0">View</button>
                  </div>
                ))}
              </>
            )}
            {/* Agencies */}
            {!isAgencyUser && filteredAgencies.length > 0 && (
              <>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5">Agencies</p>
                {filteredAgencies.map((agency) => (
                  <div key={agency.id} className="flex items-center gap-2 px-1.5 py-1 hover:bg-muted/50 rounded-md transition-colors cursor-pointer" onClick={() => { setSelectedAgencyId(selectedAgencyId === agency.id ? null : agency.id); setExpandedClientId(null); }}>
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[11px] font-medium truncate flex-1">{agency.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleViewAgency(agency); }} className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 transition-colors flex-shrink-0">Enter</button>
                  </div>
                ))}
              </>
            )}
            {/* Clients */}
            {filteredClients.length > 0 && (
              <>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5">{isAgencyUser ? "Your clients" : "Clients"}</p>
                {filteredClients.map((client) => {
                  const isExp = expandedClientId === client.id;
                  const cUsers = usersByClient[client.id] || [];
                  const isLoading = loadingUsers === client.id;
                  return (
                    <div key={client.id}>
                      <div className="flex items-center gap-2 px-1.5 py-1 hover:bg-muted/50 rounded-md transition-colors cursor-pointer" onClick={() => toggleClient(client.id)}>
                        <ChevronRight className={`w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                        <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] font-medium truncate flex-1">{client.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleFullAccess(client); }} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors flex-shrink-0">Full</button>
                      </div>
                      {isExp && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-2"><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                          ) : cUsers.length === 0 ? (
                            <p className="text-[9px] text-muted-foreground px-1.5 py-1">No users</p>
                          ) : cUsers.map((u) => (
                            <div key={u.id} className="flex items-center gap-2 px-1.5 py-1 hover:bg-muted/50 rounded-md transition-colors">
                              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center flex-shrink-0"><span className="text-[8px] font-bold text-green-700 dark:text-green-300">{u.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}</span></div>
                              <div className="min-w-0 flex-1"><p className="text-[11px] font-medium truncate">{u.full_name}</p><p className="text-[9px] text-muted-foreground truncate">{u.role_name}</p></div>
                              <button onClick={() => handleViewAsUser(u)} className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 transition-colors flex-shrink-0">View</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Empty */}
            {!loadingData && filteredAgencies.length === 0 && filteredClients.length === 0 && searchMatchedUsers.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-4">No results</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}