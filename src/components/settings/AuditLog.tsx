import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search, Shield, UserPlus, UserMinus, Settings } from "lucide-react";

interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  category: string;
  description: string;
  actor_id: string;
  actor_name: string;
  actor_email: string | null;
  actor_type: string;
  target_id: string | null;
  target_name: string | null;
  target_type: string | null;
  agent_id: string | null;
  agent_name: string | null;
  changes: any;
}

interface AuditLogProps {
  clientId: string;
  isAgencyView?: boolean;
  agencyName?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  user: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300" },
  permission: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
  role: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  settings: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
};

const CATEGORY_ICONS: Record<string, any> = {
  user: UserPlus,
  permission: Shield,
  role: Shield,
  settings: Settings,
};

const PAGE_SIZE = 50;

export function AuditLog({ clientId, isAgencyView = false, agencyName }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [resolvedAgencyName, setResolvedAgencyName] = useState<string>(agencyName || "Agency");

  useEffect(() => {
    if (agencyName) {
      setResolvedAgencyName(agencyName);
      return;
    }
    const loadAgencyName = async () => {
      const { data } = await supabase
        .from("clients")
        .select("agency:agencies(name)")
        .eq("id", clientId)
        .single();
      if (data?.agency && typeof data.agency === 'object' && 'name' in data.agency) {
        setResolvedAgencyName((data.agency as any).name || "Agency");
      }
    };
    loadAgencyName();
  }, [clientId, agencyName]);

  useEffect(() => {
    loadAgents();
  }, [clientId]);

  useEffect(() => {
    setPage(0);
    setEntries([]);
    loadEntries(0);
  }, [clientId, categoryFilter, agentFilter, searchQuery]);

  const loadAgents = async () => {
    const { data } = await supabase
      .from("agent_assignments")
      .select("agents(id, name)")
      .eq("client_id", clientId);
    const agentList = (data || [])
      .map((a: any) => a.agents)
      .filter(Boolean)
      .map((a: any) => ({ id: a.id, name: a.name }));
    setAgents(agentList);
  };

  const loadEntries = async (pageNum: number) => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_log")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }
      if (agentFilter !== "all") {
        query = query.eq("agent_id", agentFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(
          `actor_name.ilike.%${searchQuery}%,target_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const newEntries = (data || []) as AuditEntry[];
      if (pageNum === 0) {
        setEntries(newEntries);
      } else {
        setEntries(prev => [...prev, ...newEntries]);
      }
      setHasMore(newEntries.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading audit log:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadEntries(nextPage);
  };

  // Group entries by date
  const groupedByDate = entries.reduce<Record<string, AuditEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  const getActorDisplay = (entry: AuditEntry) => {
    if (entry.actor_type === "agency_user" || entry.actor_type === "super_admin") {
      return resolvedAgencyName;
    }
    return entry.actor_name || "System";
  };

  const getActorBadgeClass = (entry: AuditEntry) => {
    if (entry.actor_type === "agency_user" || entry.actor_type === "super_admin") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 rounded";
    }
    return "";
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.settings;
  };

  const getActionIcon = (entry: AuditEntry) => {
    if (entry.action === "deleted" && entry.category === "user") return UserMinus;
    return CATEGORY_ICONS[entry.category] || Settings;
  };

  const getActionIconBg = (entry: AuditEntry) => {
    if (entry.action === "deleted") return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
    const colors = getCategoryColor(entry.category);
    return `${colors.bg} ${colors.text}`;
  };

  const formatChanges = (changes: any): string | null => {
    if (!changes || typeof changes !== "object") return null;
    try {
      const parts: string[] = [];
      if (changes.permissions) {
        const perms = changes.permissions;
        if (perms.from && perms.to) {
          Object.keys(perms.to).forEach(key => {
            if (perms.from[key] !== perms.to[key]) {
              parts.push(`${key.replace(/_/g, " ")}: ${perms.to[key] ? "on" : "off"}`);
            }
          });
        } else {
          Object.entries(perms).forEach(([key, val]) => {
            if (typeof val === "boolean") {
              parts.push(`${key.replace(/_/g, " ")}: ${val ? "on" : "off"}`);
            }
          });
        }
      }
      if (changes.role_name) parts.push(`Role: ${changes.role_name}`);
      if (changes.department_name) parts.push(`Dept: ${changes.department_name}`);
      if (changes.client_permissions) {
        const cp = changes.client_permissions;
        if (cp.from && cp.to) {
          Object.keys(cp.to).forEach(key => {
            if (cp.from[key] !== cp.to[key]) {
              parts.push(`${key.replace(/_/g, " ")}: ${cp.to[key] ? "on" : "off"}`);
            }
          });
        }
      }
      return parts.length > 0 ? parts.join(", ") : null;
    } catch {
      return null;
    }
  };

  const toggleDay = (date: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading audit log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by actor, target, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="permission">Permission</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
        {agents.length > 1 && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Entries grouped by date */}
      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            {searchQuery || categoryFilter !== "all" || agentFilter !== "all"
              ? "No entries match your filters."
              : "No audit log entries yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dayEntries]) => {
            const isCollapsed = collapsedDays.has(date);
            return (
              <div key={date}>
                {/* Day header */}
                <button
                  className="flex items-center gap-2 w-full text-left py-2 group"
                  onClick={() => toggleDay(date)}
                >
                  <span className="text-sm font-semibold text-foreground">{date}</span>
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted-foreground">
                    {dayEntries.length} event{dayEntries.length !== 1 ? "s" : ""}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* Entries */}
                {!isCollapsed && dayEntries.map(entry => {
                  const IconComponent = getActionIcon(entry);
                  const isExpanded = expandedEntryId === entry.id;
                  const changesSummary = formatChanges(entry.changes);

                  return (
                    <div key={entry.id} className="border-l-2 border-border ml-2 pl-4">
                      <button
                        className="flex items-start gap-3 w-full text-left py-2 hover:bg-muted/30 rounded-md px-2 -ml-2 transition-colors"
                        onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      >
                        {/* Time */}
                        <span className="text-xs text-muted-foreground w-12 pt-0.5 shrink-0">
                          {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>

                        {/* Icon */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${getActionIconBg(entry)}`}>
                          <IconComponent className="w-3 h-3" />
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className={`font-medium ${getActorBadgeClass(entry)}`}>
                              {getActorDisplay(entry)}
                            </span>
                            {" "}
                            <span className="text-muted-foreground">{entry.description}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryColor(entry.category).bg} ${getCategoryColor(entry.category).text}`}>
                              {entry.category}
                            </span>
                            {entry.agent_name && (
                              <span className="text-xs text-muted-foreground">{entry.agent_name}</span>
                            )}
                            {changesSummary && (
                              <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {changesSummary}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expand indicator */}
                        {entry.changes && (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          )
                        )}
                      </button>

                      {/* Expanded details */}
                      {isExpanded && entry.changes && (
                        <div className="ml-[4.5rem] mb-3 p-3 bg-muted/50 rounded-md border border-border text-xs space-y-2">
                          <p className="font-medium text-foreground">Change details</p>
                          <pre className="whitespace-pre-wrap text-muted-foreground overflow-auto max-h-48">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                          <div className="flex gap-4 text-muted-foreground pt-1 border-t border-border">
                            {isAgencyView && (entry.actor_type === "agency_user" || entry.actor_type === "super_admin") && <span>Actor: {entry.actor_email || entry.actor_name}</span>}
                            {entry.target_name && <span>Target: {entry.target_name}</span>}
                            <span>ID: {entry.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                {loading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
