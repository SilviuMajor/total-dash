import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "@/hooks/useAnalyticsMetrics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AgentsAnalyticsProps {
  agentId: string;
  dateRange: DateRange;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface AgentStats {
  id: string;
  name: string;
  totalHandovers: number;
  avgAcceptTime: number;
  avgResponseTime: number;
  avgDuration: number;
  timeoutCount: number;
  resolvedCount: number;
}

export function AgentsAnalytics({ agentId, dateRange }: AgentsAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [totalActive, setTotalActive] = useState(0);

  useEffect(() => { loadData(); }, [agentId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", agentId)
        .gte("started_at", dateRange.from.toISOString())
        .lte("started_at", dateRange.to.toISOString());

      const convIds = (convs || []).map(c => c.id);
      if (convIds.length === 0) {
        setAgents([]);
        setTotalActive(0);
        setLoading(false);
        return;
      }

      const { data: sessions } = await supabase
        .from("handover_sessions")
        .select("id, status, requested_at, accepted_at, completed_at, completion_method, client_user_id, conversation_id")
        .in("conversation_id", convIds)
        .gte("requested_at", dateRange.from.toISOString())
        .lte("requested_at", dateRange.to.toISOString());

      const claimedByIds = [...new Set((sessions || []).filter(s => s.client_user_id).map(s => s.client_user_id!))];
      const userNames: Record<string, string> = {};
      if (claimedByIds.length > 0) {
        const { data: users } = await supabase
          .from("client_users")
          .select("id, full_name")
          .in("id", claimedByIds);
        for (const u of (users || [])) {
          userNames[u.id] = u.full_name || "Unknown";
        }
      }

      const agentMap = new Map<string, { sessions: any[] }>();
      for (const s of (sessions || [])) {
        if (!s.client_user_id) continue;
        const existing = agentMap.get(s.client_user_id) || { sessions: [] };
        existing.sessions.push(s);
        agentMap.set(s.client_user_id, existing);
      }

      const agentResponseTimes = new Map<string, number[]>();
      for (const [agentUserId, agentData] of agentMap) {
        const agentConvIds = agentData.sessions.map((s: any) => s.conversation_id).slice(0, 20);
        if (agentConvIds.length === 0) continue;

        const { data: transcripts } = await supabase
          .from("transcripts")
          .select("conversation_id, speaker, timestamp")
          .in("conversation_id", agentConvIds)
          .in("speaker", ["user", "client_user"])
          .order("timestamp", { ascending: true });

        if (transcripts) {
          const times: number[] = [];
          const grouped = new Map<string, typeof transcripts>();
          transcripts.forEach(t => {
            const arr = grouped.get(t.conversation_id) || [];
            arr.push(t);
            grouped.set(t.conversation_id, arr);
          });
          for (const [, msgs] of grouped) {
            for (let i = 0; i < msgs.length - 1; i++) {
              if (msgs[i].speaker === "user" && msgs[i + 1].speaker === "client_user") {
                const gap = (new Date(msgs[i + 1].timestamp!).getTime() - new Date(msgs[i].timestamp!).getTime()) / 1000;
                if (gap > 0 && gap < 3600) times.push(gap);
              }
            }
          }
          agentResponseTimes.set(agentUserId, times);
        }
      }

      const agentStats: AgentStats[] = Array.from(agentMap.entries()).map(([id, data]) => {
        const acceptTimes = data.sessions
          .filter((s: any) => s.accepted_at)
          .map((s: any) => (new Date(s.accepted_at!).getTime() - new Date(s.requested_at).getTime()) / 1000)
          .filter((t: number) => t > 0 && t < 86400);

        const sessionDurations = data.sessions
          .filter((s: any) => s.accepted_at && s.completed_at)
          .map((s: any) => (new Date(s.completed_at!).getTime() - new Date(s.accepted_at!).getTime()) / 1000)
          .filter((t: number) => t > 0 && t < 86400);

        const respTimes = agentResponseTimes.get(id) || [];

        return {
          id,
          name: userNames[id] || "Unknown",
          totalHandovers: data.sessions.length,
          avgAcceptTime: acceptTimes.length > 0 ? acceptTimes.reduce((a: number, b: number) => a + b, 0) / acceptTimes.length : 0,
          avgResponseTime: respTimes.length > 0 ? respTimes.reduce((a, b) => a + b, 0) / respTimes.length : 0,
          avgDuration: sessionDurations.length > 0 ? sessionDurations.reduce((a: number, b: number) => a + b, 0) / sessionDurations.length : 0,
          timeoutCount: data.sessions.filter((s: any) => s.status === "timeout" || s.completion_method === "timeout").length,
          resolvedCount: data.sessions.filter((s: any) => s.completion_method === "handback").length,
        };
      }).sort((a, b) => b.totalHandovers - a.totalHandovers);

      const active = (sessions || []).filter(s => s.status === "active").length;

      setAgents(agentStats);
      setTotalActive(active);
    } catch (e) {
      console.error("Error loading agent analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Active Agents</p>
          <p className="text-2xl font-bold mt-1">{agents.length}</p>
          <p className="text-xs text-muted-foreground">handled handovers this period</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Currently Active</p>
          <p className="text-2xl font-bold mt-1">{totalActive}</p>
          <p className="text-xs text-muted-foreground">handovers in progress</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Team Avg Response</p>
          <p className="text-2xl font-bold mt-1">
            {agents.length > 0 ? formatDuration(agents.filter(a => a.avgResponseTime > 0).reduce((sum, a) => sum + a.avgResponseTime, 0) / Math.max(agents.filter(a => a.avgResponseTime > 0).length, 1)) : "—"}
          </p>
        </Card>
      </div>

      {agents.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Handovers by Agent</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agents} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="totalHandovers" fill="var(--theme-fg)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Agent Performance</p>
        {agents.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">Agent</th>
                  <th className="text-right py-2 font-medium">Handovers</th>
                  <th className="text-right py-2 font-medium">Avg Accept</th>
                  <th className="text-right py-2 font-medium">Avg Response</th>
                  <th className="text-right py-2 font-medium">Avg Duration</th>
                  <th className="text-right py-2 font-medium">Resolved</th>
                  <th className="text-right py-2 font-medium">Timeouts</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2">{agent.name}</td>
                    <td className="text-right py-2">{agent.totalHandovers}</td>
                    <td className="text-right py-2">{formatDuration(agent.avgAcceptTime)}</td>
                    <td className="text-right py-2">{formatDuration(agent.avgResponseTime)}</td>
                    <td className="text-right py-2">{formatDuration(agent.avgDuration)}</td>
                    <td className="text-right py-2">{agent.resolvedCount}</td>
                    <td className="text-right py-2">{agent.timeoutCount > 0 ? <span className="text-destructive">{agent.timeoutCount}</span> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">No agent data for this period</p>
        )}
      </Card>
    </div>
  );
}
