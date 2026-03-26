import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "@/hooks/useAnalyticsMetrics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface OverviewAnalyticsProps {
  agentId: string;
  dateRange: DateRange;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const STATUS_COLORS: Record<string, string> = {
  with_ai: "#22c55e",
  in_handover: "#3b82f6",
  aftercare: "#f59e0b",
  needs_review: "#ef4444",
  resolved: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  with_ai: "With AI",
  in_handover: "In Handover",
  aftercare: "Aftercare",
  needs_review: "Needs Review",
  resolved: "Resolved",
};

function TrendBadge({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isPositive = inverse ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 1;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-600"}`}>
      {isNeutral ? <Minus className="h-3 w-3" /> : isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

interface OverviewData {
  totalConvs: number;
  prevTotalConvs: number;
  aiResolutionRate: number;
  handoverRate: number;
  handoverCount: number;
  prevHandoverCount: number;
  avgDuration: number;
  prevAvgDuration: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  peakHours: { hour: string; count: number }[];
  peakHour: string;
  volumeOverTime: { date: string; count: number }[];
}

export function OverviewAnalytics({ agentId, dateRange }: OverviewAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    loadData();
  }, [agentId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const periodMs = dateRange.to.getTime() - dateRange.from.getTime();
      const prevFrom = new Date(dateRange.from.getTime() - periodMs);
      const prevTo = new Date(dateRange.from.getTime());

      const { data: current } = await supabase
        .from("conversations")
        .select("id, status, started_at, ended_at, duration, metadata, department_id")
        .eq("agent_id", agentId)
        .gte("started_at", dateRange.from.toISOString())
        .lte("started_at", dateRange.to.toISOString());

      const { data: previous } = await supabase
        .from("conversations")
        .select("id, status, started_at, ended_at, duration, metadata, department_id")
        .eq("agent_id", agentId)
        .gte("started_at", prevFrom.toISOString())
        .lte("started_at", prevTo.toISOString());

      const convIds = (current || []).map(c => c.id);
      let handoverCount = 0;
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("handover_sessions")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", convIds);
        handoverCount = count || 0;
      }

      let prevHandoverCount = 0;
      const prevConvIds = (previous || []).map(c => c.id);
      if (prevConvIds.length > 0) {
        const { count } = await supabase
          .from("handover_sessions")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", prevConvIds);
        prevHandoverCount = count || 0;
      }

      const convs = current || [];
      const prevConvs = previous || [];
      const totalConvs = convs.length;
      const prevTotalConvs = prevConvs.length;

      const convsWithHandover = new Set<string>();
      if (convIds.length > 0) {
        const { data: hoSessions } = await supabase
          .from("handover_sessions")
          .select("conversation_id")
          .in("conversation_id", convIds);
        (hoSessions || []).forEach(s => convsWithHandover.add(s.conversation_id));
      }
      const aiResolvedCount = convs.filter(c => !convsWithHandover.has(c.id) && (c.status === "resolved" || c.ended_at)).length;
      const aiResolutionRate = totalConvs > 0 ? (aiResolvedCount / totalConvs) * 100 : 0;
      const handoverRate = totalConvs > 0 ? (convsWithHandover.size / totalConvs) * 100 : 0;

      const durations = convs.filter(c => c.duration && c.duration > 0).map(c => c.duration!);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const prevDurations = prevConvs.filter(c => c.duration && c.duration > 0).map(c => c.duration!);
      const prevAvgDuration = prevDurations.length > 0 ? prevDurations.reduce((a, b) => a + b, 0) / prevDurations.length : 0;

      const statusCounts: Record<string, number> = {};
      for (const c of convs) {
        const s = c.status || "unknown";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        color: STATUS_COLORS[status] || "#6b7280",
      }));

      const hourCounts: Record<number, number> = {};
      for (const c of convs) {
        if (!c.started_at) continue;
        const hour = new Date(c.started_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const peakHours = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        count: hourCounts[i] || 0,
      }));
      const peakHourEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

      const dayMap = new Map<string, number>();
      for (const c of convs) {
        if (!c.started_at) continue;
        const day = new Date(c.started_at).toISOString().split("T")[0];
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      const volumeOverTime = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        totalConvs, prevTotalConvs,
        aiResolutionRate,
        handoverRate, handoverCount, prevHandoverCount,
        avgDuration, prevAvgDuration,
        statusBreakdown,
        peakHours, peakHour: peakHourEntry ? `${peakHourEntry[0].padStart(2, "0")}:00` : "—",
        volumeOverTime,
      });
    } catch (e) {
      console.error("Error loading overview:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}
      </div>
    );
  }

  if (!data) return <p className="p-6 text-muted-foreground">No data available</p>;

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Conversations</p>
          <p className="text-2xl font-bold mt-1">{data.totalConvs}</p>
          <TrendBadge current={data.totalConvs} previous={data.prevTotalConvs} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">AI Resolution Rate</p>
          <p className="text-2xl font-bold mt-1">{data.aiResolutionRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Resolved without handover</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Handover Rate</p>
          <p className="text-2xl font-bold mt-1">{data.handoverRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{data.handoverCount} handovers</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Duration</p>
          <p className="text-2xl font-bold mt-1">{formatDuration(data.avgDuration)}</p>
          <TrendBadge current={data.avgDuration} previous={data.prevAvgDuration} inverse />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Peak Hour</p>
          <p className="text-2xl font-bold mt-1">{data.peakHour}</p>
          <p className="text-xs text-muted-foreground">Busiest time</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Conversation Volume</p>
          {data.volumeOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.volumeOverTime}>
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
          <p className="text-sm font-medium mb-3">Status Breakdown</p>
          {data.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.statusBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
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
      </div>

      {/* Peak hours */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Activity by Hour</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.peakHours}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
