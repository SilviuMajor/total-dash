import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "@/hooks/useAnalyticsMetrics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

interface HandoverAnalyticsProps {
  agentId: string;
  dateRange: DateRange;
}

interface HandoverMetrics {
  totalHandovers: number;
  avgTimeToAccept: number;
  avgResponseTime: number;
  avgDuration: number;
  timeoutRate: number;
  timeoutCount: number;
  completedCount: number;
  byAgent: { name: string; count: number; avgAcceptTime: number; avgResponseTime: number }[];
  byDepartment: { name: string; color: string; count: number; avgAcceptTime: number }[];
  volumeOverTime: { date: string; count: number }[];
  responseTimeTrend: { date: string; avgTime: number }[];
  outcomeBreakdown: { name: string; value: number }[];
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const OUTCOME_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

export function HandoverAnalytics({ agentId, dateRange }: HandoverAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<HandoverMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [agentId, dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: sessions, error: sessError } = await supabase
        .from("handover_sessions")
        .select(`
          id, status, requested_at, accepted_at, completed_at,
          completion_method, client_user_id, department_id, conversation_id,
          departments:department_id(name, color)
        `)
        .gte("requested_at", dateRange.from.toISOString())
        .lte("requested_at", dateRange.to.toISOString());

      if (sessError) throw sessError;

      const { data: agentConvIds } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", agentId);

      const validConvIds = new Set((agentConvIds || []).map(c => c.id));
      const filteredSessions = (sessions || []).filter(s => validConvIds.has(s.conversation_id));

      const claimedByIds = [...new Set(filteredSessions.filter(s => s.client_user_id).map(s => s.client_user_id!))];
      const agentNames: Record<string, string> = {};
      if (claimedByIds.length > 0) {
        const { data: users } = await supabase
          .from("client_users")
          .select("id, full_name")
          .in("id", claimedByIds);
        for (const u of (users || [])) {
          agentNames[u.id] = u.full_name || "Unknown";
        }
      }

      const total = filteredSessions.length;
      const accepted = filteredSessions.filter(s => s.accepted_at);
      const completed = filteredSessions.filter(s => s.status === "completed");
      const timedOut = filteredSessions.filter(s => s.status === "timeout" || s.completion_method === "timeout");

      const acceptTimes = accepted
        .map(s => (new Date(s.accepted_at!).getTime() - new Date(s.requested_at!).getTime()) / 1000)
        .filter(t => t > 0 && t < 86400);
      const avgAccept = acceptTimes.length > 0 ? acceptTimes.reduce((a, b) => a + b, 0) / acceptTimes.length : 0;

      const durations = completed
        .filter(s => s.accepted_at && s.completed_at)
        .map(s => (new Date(s.completed_at!).getTime() - new Date(s.accepted_at!).getTime()) / 1000)
        .filter(t => t > 0 && t < 86400);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      // By agent
      const agentMap = new Map<string, { count: number; acceptTimes: number[] }>();
      for (const s of filteredSessions) {
        if (!s.client_user_id) continue;
        const existing = agentMap.get(s.client_user_id) || { count: 0, acceptTimes: [] };
        existing.count++;
        if (s.accepted_at) {
          existing.acceptTimes.push((new Date(s.accepted_at).getTime() - new Date(s.requested_at!).getTime()) / 1000);
        }
        agentMap.set(s.client_user_id, existing);
      }
      const byAgent = Array.from(agentMap.entries()).map(([id, data]) => ({
        name: agentNames[id] || "Unknown",
        count: data.count,
        avgAcceptTime: data.acceptTimes.length > 0 ? data.acceptTimes.reduce((a, b) => a + b, 0) / data.acceptTimes.length : 0,
        avgResponseTime: 0,
      })).sort((a, b) => b.count - a.count);

      // By department
      const deptMap = new Map<string, { name: string; color: string; count: number; acceptTimes: number[] }>();
      for (const s of filteredSessions) {
        const dept = (s as any).departments;
        const deptId = s.department_id || "unknown";
        const existing = deptMap.get(deptId) || { name: dept?.name || "Unknown", color: dept?.color || "#6b7280", count: 0, acceptTimes: [] };
        existing.count++;
        if (s.accepted_at) {
          existing.acceptTimes.push((new Date(s.accepted_at).getTime() - new Date(s.requested_at!).getTime()) / 1000);
        }
        deptMap.set(deptId, existing);
      }
      const byDepartment = Array.from(deptMap.values()).map(d => ({
        name: d.name,
        color: d.color,
        count: d.count,
        avgAcceptTime: d.acceptTimes.length > 0 ? d.acceptTimes.reduce((a, b) => a + b, 0) / d.acceptTimes.length : 0,
      })).sort((a, b) => b.count - a.count);

      // Volume over time
      const dayMap = new Map<string, number>();
      for (const s of filteredSessions) {
        const day = new Date(s.requested_at!).toISOString().split("T")[0];
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      const volumeOverTime = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Response time trend
      const trendMap = new Map<string, number[]>();
      for (const s of accepted) {
        const day = new Date(s.requested_at!).toISOString().split("T")[0];
        const acceptTime = (new Date(s.accepted_at!).getTime() - new Date(s.requested_at!).getTime()) / 1000;
        if (acceptTime > 0 && acceptTime < 86400) {
          const arr = trendMap.get(day) || [];
          arr.push(acceptTime);
          trendMap.set(day, arr);
        }
      }
      const responseTimeTrend = Array.from(trendMap.entries())
        .map(([date, times]) => ({ date, avgTime: times.reduce((a, b) => a + b, 0) / times.length }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Outcome breakdown
      const outcomes: Record<string, number> = {};
      for (const s of filteredSessions) {
        const outcome = s.completion_method || s.status || "unknown";
        const label = outcome === "handback" ? "Completed" : outcome === "timeout" ? "Timed Out" : outcome === "inactivity" ? "Inactivity" : outcome === "transfer" ? "Transferred" : outcome === "pending" ? "Pending" : outcome;
        outcomes[label] = (outcomes[label] || 0) + 1;
      }
      const outcomeBreakdown = Object.entries(outcomes).map(([name, value]) => ({ name, value }));

      // Avg response time from transcripts
      let avgResponseTime = 0;
      try {
        const convIds = filteredSessions.filter(s => s.accepted_at).map(s => s.conversation_id);
        if (convIds.length > 0) {
          const { data: transcripts } = await supabase
            .from("transcripts")
            .select("conversation_id, speaker, timestamp")
            .in("conversation_id", convIds.slice(0, 50))
            .in("speaker", ["user", "client_user"])
            .order("timestamp", { ascending: true });

          if (transcripts && transcripts.length > 0) {
            const responseTimes: number[] = [];
            const convTranscripts = new Map<string, typeof transcripts>();
            for (const t of transcripts) {
              const arr = convTranscripts.get(t.conversation_id) || [];
              arr.push(t);
              convTranscripts.set(t.conversation_id, arr);
            }
            for (const [, msgs] of convTranscripts) {
              for (let i = 0; i < msgs.length - 1; i++) {
                if (msgs[i].speaker === "user" && msgs[i + 1].speaker === "client_user") {
                  const gap = (new Date(msgs[i + 1].timestamp!).getTime() - new Date(msgs[i].timestamp!).getTime()) / 1000;
                  if (gap > 0 && gap < 3600) responseTimes.push(gap);
                }
              }
            }
            if (responseTimes.length > 0) {
              avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            }
          }
        }
      } catch (e) {
        console.error("Error calculating response times:", e);
      }

      setMetrics({
        totalHandovers: total,
        avgTimeToAccept: avgAccept,
        avgResponseTime,
        avgDuration,
        timeoutRate: total > 0 ? (timedOut.length / total) * 100 : 0,
        timeoutCount: timedOut.length,
        completedCount: completed.length,
        byAgent,
        byDepartment,
        volumeOverTime,
        responseTimeTrend,
        outcomeBreakdown,
      });
    } catch (e) {
      console.error("Error loading handover metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="h-32 animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return <p className="p-6 text-muted-foreground">No data available</p>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top-level metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Handover Requests</p>
          <p className="text-2xl font-bold mt-1">{metrics.totalHandovers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Time to Accept</p>
          <p className="text-2xl font-bold mt-1">{formatDuration(metrics.avgTimeToAccept)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Response Time</p>
          <p className="text-2xl font-bold mt-1">{formatDuration(metrics.avgResponseTime)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Duration</p>
          <p className="text-2xl font-bold mt-1">{formatDuration(metrics.avgDuration)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Timeout Rate</p>
          <p className="text-2xl font-bold mt-1">{metrics.timeoutRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{metrics.timeoutCount} of {metrics.totalHandovers}</p>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Handover Volume</p>
          {metrics.volumeOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.volumeOverTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No data for this period</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Avg Accept Time Trend</p>
          {metrics.responseTimeTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={metrics.responseTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatDuration(v)} />
                <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} formatter={(v: number) => [formatDuration(v), "Avg Accept Time"]} />
                <Line type="monotone" dataKey="avgTime" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No data for this period</p>
          )}
        </Card>
      </div>

      {/* Outcome + tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Outcomes</p>
          {metrics.outcomeBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={metrics.outcomeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {metrics.outcomeBreakdown.map((_, i) => (
                    <Cell key={i} fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No data</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-3">By Agent</p>
          {metrics.byAgent.length > 0 ? (
            <div className="overflow-auto max-h-[240px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1.5 font-medium">Agent</th>
                    <th className="text-right py-1.5 font-medium">Handovers</th>
                    <th className="text-right py-1.5 font-medium">Avg Accept</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byAgent.map((agent, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5">{agent.name}</td>
                      <td className="text-right py-1.5">{agent.count}</td>
                      <td className="text-right py-1.5">{formatDuration(agent.avgAcceptTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No agent data</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-3">By Department</p>
          {metrics.byDepartment.length > 0 ? (
            <div className="overflow-auto max-h-[240px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1.5 font-medium">Department</th>
                    <th className="text-right py-1.5 font-medium">Requests</th>
                    <th className="text-right py-1.5 font-medium">Avg Accept</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byDepartment.map((dept, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: dept.color }} />
                        {dept.name}
                      </td>
                      <td className="text-right py-1.5">{dept.count}</td>
                      <td className="text-right py-1.5">{formatDuration(dept.avgAcceptTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No department data</p>
          )}
        </Card>
      </div>
    </div>
  );
}
