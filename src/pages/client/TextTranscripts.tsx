import { useState, useEffect, useMemo } from "react";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Download, FileJson } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type Json = any;

interface DepartmentRef {
  id: string;
  name: string | null;
  color: string | null;
}

interface HandoverSummary {
  id: string;
  status: string | null;
  takeover_type: string | null;
  completion_method: string | null;
  completed_at: string | null;
  agent_name: string | null;
}

interface ConversationRow {
  id: string;
  agent_id: string;
  status: string | null;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  last_activity_at: string | null;
  last_customer_message_at: string | null;
  sentiment: string | null;
  resolution_reason: string | null;
  resolution_note: string | null;
  needs_review_reason: string | null;
  is_widget_test: boolean | null;
  caller_phone: string | null;
  voiceflow_user_id: string | null;
  metadata: Json | null;
  owner_id: string | null;
  owner_name: string | null;
  department_id: string | null;
  departments: DepartmentRef | null;
  handover_sessions: HandoverSummary[] | null;
  conversation_tags: { tag_name: string }[] | null;
}

interface TranscriptMessage {
  id: string;
  conversation_id: string;
  speaker: string;
  text: string | null;
  timestamp: string;
  buttons: Json | null;
  attachments: Attachment[] | null;
  metadata: Json | null;
  confidence: number | null;
}

interface Attachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  kind?: "image" | "video" | "audio" | "file";
}

interface HandoverSession {
  id: string;
  conversation_id: string;
  status: string | null;
  takeover_type: string | null;
  created_at: string;
  requested_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  client_user_id: string | null;
  agent_name: string | null;
  transferred_from_agent_name: string | null;
  transferred_from_department_name: string | null;
  department_id: string | null;
  original_department_id: string | null;
  timeout_duration: number | null;
  fallback_occurred: boolean | null;
  fallback_count: number | null;
  completion_method: string | null;
  transfer_note: string | null;
  inactivity_reset_at: string | null;
  previous_session_id: string | null;
  departments: { name: string | null; color: string | null } | null;
}

interface StatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  changed_by_id: string | null;
  changed_by_type: string | null;
  metadata: Json | null;
}

interface TagRow {
  id: string;
  tag_name: string;
  created_at: string;
  applied_by: string | null;
  is_system: boolean | null;
  client_users: { full_name: string | null } | null;
}

interface ReadStatusRow {
  id: string;
  client_user_id: string;
  is_read: boolean | null;
  last_read_at: string | null;
  client_users: { full_name: string | null } | null;
}

interface DetailData {
  transcripts: TranscriptMessage[];
  handovers: HandoverSession[];
  statusHistory: StatusHistoryRow[];
  tags: TagRow[];
  readBy: ReadStatusRow[];
}

const LIST_LIMIT = 200;

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const customerNameOf = (conv: ConversationRow): string | null =>
  conv.metadata?.variables?.user_name ?? null;

const customerEmailOf = (conv: ConversationRow): string | null =>
  conv.metadata?.variables?.user_email ?? null;

const customerPhoneOf = (conv: ConversationRow): string | null =>
  conv.metadata?.variables?.user_phone ?? conv.caller_phone ?? null;

const finalAcceptorName = (conv: ConversationRow): string | null => {
  const sessions = conv.handover_sessions ?? [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].agent_name) return sessions[i].agent_name;
  }
  return conv.owner_name ?? null;
};

const initialsOf = (name: string | null | undefined): string => {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export default function TextTranscripts() {
  const { selectedAgentId } = useClientAgentContext();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("7");
  const [resolutionFilter, setResolutionFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [includeTest, setIncludeTest] = useState(false);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (selectedAgentId) loadConversations();
  }, [selectedAgentId, dateFilter]);

  const loadConversations = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("conversations")
        .select(
          `id, agent_id, status, started_at, ended_at, duration,
           last_activity_at, last_customer_message_at,
           sentiment, resolution_reason, resolution_note,
           needs_review_reason, is_widget_test,
           caller_phone, voiceflow_user_id,
           metadata, owner_id, owner_name, department_id,
           departments:department_id ( id, name, color ),
           handover_sessions ( id, status, takeover_type, completion_method, completed_at, agent_name ),
           conversation_tags ( tag_name )`
        )
        .eq("agent_id", selectedAgentId)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(LIST_LIMIT);

      if (dateFilter !== "all") {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));
        query = query.gte("ended_at", daysAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setConversations((data ?? []) as unknown as ConversationRow[]);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation archive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (conv: ConversationRow) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const [transcriptsRes, handoversRes, statusRes, tagsRes, readRes] = await Promise.all([
        supabase
          .from("transcripts")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("timestamp", { ascending: true }),
        supabase
          .from("handover_sessions")
          .select("*, departments:department_id ( name, color )")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversation_status_history")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversation_tags")
          .select("*, client_users:applied_by ( full_name )")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversation_read_status")
          .select("*, client_users ( full_name )")
          .eq("conversation_id", conv.id)
          .eq("is_read", true),
      ]);

      setDetail({
        transcripts: (transcriptsRes.data ?? []) as unknown as TranscriptMessage[],
        handovers: (handoversRes.data ?? []) as unknown as HandoverSession[],
        statusHistory: (statusRes.data ?? []) as unknown as StatusHistoryRow[],
        tags: (tagsRes.data ?? []) as unknown as TagRow[],
        readBy: (readRes.data ?? []) as unknown as ReadStatusRow[],
      });
    } catch (error) {
      console.error("Error fetching conversation detail:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation detail",
        variant: "destructive",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (conv: ConversationRow) => {
    setSelected(conv);
    loadDetail(conv);
  };

  const handleCloseDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const resolutionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) if (c.resolution_reason) set.add(c.resolution_reason);
    return Array.from(set).sort();
  }, [conversations]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (c.department_id && c.departments?.name) {
        map.set(c.department_id, c.departments.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [conversations]);

  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      if (c.owner_name) set.add(c.owner_name);
      for (const h of c.handover_sessions ?? []) {
        if (h.agent_name) set.add(h.agent_name);
      }
    }
    return Array.from(set).sort();
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!includeTest && c.is_widget_test) return false;
      if (resolutionFilter !== "all" && c.resolution_reason !== resolutionFilter) return false;
      if (departmentFilter !== "all" && c.department_id !== departmentFilter) return false;
      if (staffFilter !== "all") {
        const involved = [
          c.owner_name,
          ...(c.handover_sessions ?? []).map((h) => h.agent_name),
        ].filter(Boolean);
        if (!involved.includes(staffFilter)) return false;
      }
      if (q) {
        const hay = [
          customerNameOf(c),
          customerEmailOf(c),
          customerPhoneOf(c),
          c.resolution_reason,
          c.resolution_note,
          c.owner_name,
          ...(c.conversation_tags ?? []).map((t) => t.tag_name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [conversations, searchQuery, resolutionFilter, departmentFilter, staffFilter, includeTest]);

  const exportPlaintext = () => {
    if (!selected || !detail) return;
    const lines: string[] = [];
    lines.push("Conversation Archive Export");
    lines.push("===========================");
    lines.push("");
    lines.push(`Customer: ${customerNameOf(selected) ?? "Anonymous"}`);
    lines.push(`Email: ${customerEmailOf(selected) ?? "N/A"}`);
    lines.push(`Phone: ${customerPhoneOf(selected) ?? "N/A"}`);
    lines.push(`Started: ${format(new Date(selected.started_at), "PPpp")}`);
    if (selected.ended_at) lines.push(`Ended: ${format(new Date(selected.ended_at), "PPpp")}`);
    lines.push(`Duration: ${formatDuration(selected.duration)}`);
    lines.push(`Status: ${selected.status ?? "—"}`);
    lines.push(`Final department: ${selected.departments?.name ?? "—"}`);
    lines.push(`Final owner: ${selected.owner_name ?? "—"}`);
    lines.push(`Resolution: ${selected.resolution_reason ?? "—"}`);
    if (selected.resolution_note) lines.push(`Resolution note: ${selected.resolution_note}`);
    lines.push(`Tags: ${(detail.tags ?? []).map((t) => t.tag_name).join(", ") || "—"}`);
    lines.push("");
    lines.push("Messages");
    lines.push("--------");
    for (const m of detail.transcripts) {
      const who =
        m.speaker === "client_user"
          ? m.metadata?.client_user_name ?? "Staff"
          : m.speaker;
      lines.push(`[${format(new Date(m.timestamp), "HH:mm:ss")}] ${who}: ${m.text ?? ""}`);
    }
    if (detail.handovers.length) {
      lines.push("");
      lines.push("Handover sessions");
      lines.push("-----------------");
      for (const h of detail.handovers) {
        lines.push(
          `${format(new Date(h.created_at), "HH:mm:ss")} — ${h.takeover_type ?? "handover"} → ${
            h.agent_name ?? "(unassigned)"
          } (${h.status ?? "?"}, completion: ${h.completion_method ?? "—"})`
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${selected.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!selected || !detail) return;
    const payload = {
      conversation: selected,
      transcripts: detail.transcripts,
      handovers: detail.handovers,
      status_history: detail.statusHistory,
      tags: detail.tags,
      read_by: detail.readBy,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${selected.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedAgentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select an agent to view transcripts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-lg font-semibold">Transcripts</h1>
          <p className="text-sm text-muted-foreground">
            Read-only archive of every ended conversation. Always reflects current state.
          </p>
        </div>
      </div>

      <div className="border-b border-border bg-background p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, tag, resolution..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Resolution" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resolutions</SelectItem>
              {resolutionOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
            <Label htmlFor="include-test" className="text-sm">Include test conversations</Label>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto p-6">
          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {conversations.length === 0
                ? "No ended conversations yet for this agent."
                : "No conversations match the current filters."}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Ended</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Resolution</th>
                      <th className="px-4 py-3 font-medium">Handovers</th>
                      <th className="px-4 py-3 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((c) => {
                      const handoverCount = c.handover_sessions?.length ?? 0;
                      const acceptor = finalAcceptorName(c);
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(c)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{customerNameOf(c) ?? "Anonymous"}</div>
                            <div className="text-xs text-muted-foreground">
                              {customerEmailOf(c) ?? customerPhoneOf(c) ?? "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {c.ended_at ? format(new Date(c.ended_at), "MMM d, yyyy HH:mm") : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">{formatDuration(c.duration)}</td>
                          <td className="px-4 py-3">
                            {c.departments?.name ? (
                              <Badge
                                variant="outline"
                                style={c.departments.color ? { borderColor: c.departments.color, color: c.departments.color } : undefined}
                              >
                                {c.departments.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {c.resolution_reason ? (
                              <Badge variant="secondary">{c.resolution_reason}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {handoverCount > 0 ? (
                              <span>
                                {handoverCount}
                                {acceptor ? <span className="text-muted-foreground"> · {acceptor}</span> : null}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {c.conversation_tags?.map((t, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {t.tag_name}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) handleCloseDetail(); }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="truncate">
                  {selected ? customerNameOf(selected) ?? "Anonymous" : ""}
                </DialogTitle>
                <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                  <p className="truncate">
                    {selected ? customerEmailOf(selected) ?? customerPhoneOf(selected) ?? "No contact info" : ""}
                  </p>
                  <p>
                    {selected?.ended_at
                      ? `Ended ${format(new Date(selected.ended_at), "PPpp")}`
                      : selected
                      ? `Started ${format(new Date(selected.started_at), "PPpp")}`
                      : ""}
                    {" · "}
                    {formatDuration(selected?.duration ?? null)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={exportPlaintext} disabled={!detail}>
                  <Download className="h-4 w-4 mr-2" />
                  Plaintext
                </Button>
                <Button variant="outline" size="sm" onClick={exportJson} disabled={!detail}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Full JSON
                </Button>
              </div>
            </div>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <Skeleton className="h-32 w-full max-w-md" />
            </div>
          ) : (
            <Tabs defaultValue="conversation" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="conversation">Conversation</TabsTrigger>
                <TabsTrigger value="handovers">
                  Handovers{detail.handovers.length ? ` (${detail.handovers.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="status">
                  Status{detail.statusHistory.length ? ` (${detail.statusHistory.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="tags">Tags & Notes</TabsTrigger>
                <TabsTrigger value="staff">Staff</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
              </TabsList>

              <TabsContent value="conversation" className="flex-1 overflow-hidden mt-3">
                <ConversationTab transcripts={detail.transcripts} />
              </TabsContent>
              <TabsContent value="handovers" className="flex-1 overflow-hidden mt-3">
                <HandoversTab handovers={detail.handovers} />
              </TabsContent>
              <TabsContent value="status" className="flex-1 overflow-hidden mt-3">
                <StatusTab history={detail.statusHistory} />
              </TabsContent>
              <TabsContent value="tags" className="flex-1 overflow-hidden mt-3">
                <TagsAndNotesTab tags={detail.tags} note={selected?.metadata?.note ?? null} resolution={selected} />
              </TabsContent>
              <TabsContent value="staff" className="flex-1 overflow-hidden mt-3">
                <StaffTab conv={selected} handovers={detail.handovers} transcripts={detail.transcripts} tags={detail.tags} readBy={detail.readBy} />
              </TabsContent>
              <TabsContent value="variables" className="flex-1 overflow-hidden mt-3">
                <VariablesTab variables={selected?.metadata?.variables ?? null} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConversationTab({ transcripts }: { transcripts: TranscriptMessage[] }) {
  if (!transcripts.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No messages.</div>;
  }
  return (
    <ScrollArea className="h-full border border-border rounded-lg p-4">
      <div className="space-y-3">
        {transcripts.map((m, idx) => {
          if (m.speaker === "system") {
            if (!m.text?.trim()) return null;
            return (
              <div key={m.id ?? idx} className="flex justify-center my-2">
                <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full border border-border">
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.speaker === "client_user") {
            const name = m.metadata?.client_user_name ?? "Staff";
            return (
              <div key={m.id ?? idx} className="flex gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-primary">
                  {initialsOf(name)}
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-primary mb-0.5 block">{name}</span>
                  <div className="bg-card border border-border px-3 py-2 rounded-xl rounded-tl-sm text-sm max-w-[460px] whitespace-pre-wrap break-words">
                    {m.text}
                  </div>
                  <AttachmentList attachments={m.attachments ?? []} />
                  <span className="text-[10px] text-muted-foreground mt-0.5 ml-1">
                    {format(new Date(m.timestamp), "h:mm a")}
                  </span>
                </div>
              </div>
            );
          }
          const isUser = m.speaker === "user";
          return (
            <div key={m.id ?? idx} className={`flex gap-2 mb-2 ${isUser ? "justify-end" : ""}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-secondary-foreground">
                  AI
                </div>
              )}
              <div className={`min-w-0 ${isUser ? "items-end flex flex-col" : ""}`}>
                <div
                  className={`px-3 py-2 rounded-xl text-sm max-w-[460px] whitespace-pre-wrap break-words ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
                <AttachmentList attachments={m.attachments ?? []} />
                <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                  {format(new Date(m.timestamp), "h:mm a")}
                </span>
              </div>
              {isUser && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-primary-foreground">
                  U
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {attachments.map((a, i) => (
        <div key={i}>
          {a.kind === "image" ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              <img
                src={a.url}
                alt={a.fileName}
                className="max-w-[260px] max-h-[200px] rounded border border-border"
              />
            </a>
          ) : (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline break-all"
            >
              {a.fileName ?? a.url}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function HandoversTab({ handovers }: { handovers: HandoverSession[] }) {
  if (!handovers.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No handover sessions.</div>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-2">
        {handovers.map((h) => (
          <Card key={h.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{h.takeover_type ?? "handover"}</Badge>
                  <Badge variant={h.status === "completed" ? "secondary" : "default"}>
                    {h.status ?? "—"}
                  </Badge>
                  {h.departments?.name && (
                    <Badge
                      variant="outline"
                      style={h.departments.color ? { borderColor: h.departments.color, color: h.departments.color } : undefined}
                    >
                      {h.departments.name}
                    </Badge>
                  )}
                  {h.fallback_occurred && (
                    <Badge variant="destructive">Fallback ×{h.fallback_count ?? 1}</Badge>
                  )}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">{h.agent_name ?? "(unassigned)"}</span>
                  {h.transferred_from_agent_name && (
                    <span className="text-muted-foreground"> ← {h.transferred_from_agent_name}</span>
                  )}
                  {h.transferred_from_department_name && (
                    <span className="text-muted-foreground"> (from {h.transferred_from_department_name})</span>
                  )}
                </div>
                {h.transfer_note && (
                  <div className="mt-2 text-sm text-muted-foreground italic">"{h.transfer_note}"</div>
                )}
                {h.previous_session_id && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Continues from session {h.previous_session_id.slice(0, 8)}…
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-right flex-shrink-0 space-y-0.5">
                <div>Created {format(new Date(h.created_at), "HH:mm:ss")}</div>
                {h.accepted_at && <div>Accepted {format(new Date(h.accepted_at), "HH:mm:ss")}</div>}
                {h.completed_at && (
                  <div>
                    Ended {format(new Date(h.completed_at), "HH:mm:ss")}
                    {h.completion_method ? ` · ${h.completion_method}` : ""}
                  </div>
                )}
                {h.timeout_duration ? <div>Timeout {h.timeout_duration}s</div> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function StatusTab({ history }: { history: StatusHistoryRow[] }) {
  if (!history.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No status changes recorded.</div>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {history.map((row) => (
          <div key={row.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
            <div className="text-xs text-muted-foreground w-32 flex-shrink-0">
              {format(new Date(row.created_at), "MMM d, HH:mm:ss")}
            </div>
            <div className="min-w-0">
              <span className="font-medium">{row.from_status ?? "—"}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-medium">{row.to_status}</span>
              {row.changed_by_type && (
                <span className="text-xs text-muted-foreground ml-2">by {row.changed_by_type}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function TagsAndNotesTab({
  tags,
  note,
  resolution,
}: {
  tags: TagRow[];
  note: string | null;
  resolution: ConversationRow | null;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 pr-2">
        <div>
          <h3 className="text-sm font-semibold mb-2">Resolution</h3>
          {resolution?.resolution_reason ? (
            <div className="space-y-1">
              <Badge variant="secondary">{resolution.resolution_reason}</Badge>
              {resolution.resolution_note && (
                <p className="text-sm text-muted-foreground">{resolution.resolution_note}</p>
              )}
              {resolution.needs_review_reason && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Flagged for review: {resolution.needs_review_reason}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No resolution recorded.</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Internal note</h3>
          {note ? (
            <div className="text-sm whitespace-pre-wrap border border-border rounded p-3 bg-muted/30">{note}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No note.</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Tags ({tags.length})</h3>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags applied.</p>
          ) : (
            <div className="space-y-2">
              {tags.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{t.tag_name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t.is_system
                      ? "system"
                      : t.client_users?.full_name ?? "—"}
                    {" · "}
                    {format(new Date(t.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function StaffTab({
  conv,
  handovers,
  transcripts,
  tags,
  readBy,
}: {
  conv: ConversationRow | null;
  handovers: HandoverSession[];
  transcripts: TranscriptMessage[];
  tags: TagRow[];
  readBy: ReadStatusRow[];
}) {
  type StaffEntry = { id: string | null; name: string; roles: Set<string> };
  const map = new Map<string, StaffEntry>();
  const add = (id: string | null, name: string | null | undefined, role: string) => {
    if (!name) return;
    const key = id ?? `name:${name}`;
    const existing = map.get(key);
    if (existing) existing.roles.add(role);
    else map.set(key, { id, name, roles: new Set([role]) });
  };
  if (conv?.owner_id || conv?.owner_name) add(conv?.owner_id ?? null, conv?.owner_name, "final owner");
  for (const h of handovers) add(h.client_user_id, h.agent_name, "acceptor");
  for (const m of transcripts) {
    if (m.speaker === "client_user") {
      add(m.metadata?.client_user_id ?? null, m.metadata?.client_user_name, "messaged");
    }
  }
  for (const t of tags) {
    if (t.applied_by) add(t.applied_by, t.client_users?.full_name, "tagged");
  }
  const involved = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 pr-2">
        <div>
          <h3 className="text-sm font-semibold mb-2">Staff involved ({involved.length})</h3>
          {involved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff interactions recorded.</p>
          ) : (
            <div className="space-y-2">
              {involved.map((s) => (
                <div key={s.id ?? s.name} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                    {initialsOf(s.name)}
                  </div>
                  <span className="font-medium">{s.name}</span>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from(s.roles).map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Read receipts</h3>
          {readBy.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No read receipts visible. (You may only see your own under current access rules.)
            </p>
          ) : (
            <div className="space-y-1">
              {readBy.map((r) => (
                <div key={r.id} className="text-sm">
                  <span className="font-medium">{r.client_users?.full_name ?? "—"}</span>
                  {r.last_read_at && (
                    <span className="text-xs text-muted-foreground">
                      {" · "}{format(new Date(r.last_read_at), "MMM d, HH:mm")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function VariablesTab({ variables }: { variables: Json | null }) {
  const entries = variables && typeof variables === "object" ? Object.entries(variables) : [];
  if (!entries.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No variables captured.</div>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {entries.map(([key, value]) => (
          <div key={key} className="text-sm">
            <div className="font-mono text-xs text-muted-foreground">{key}</div>
            <div className="font-medium break-words whitespace-pre-wrap">
              {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
