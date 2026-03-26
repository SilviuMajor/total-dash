import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "@/hooks/useAnalyticsMetrics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";

interface ConversationsAnalyticsProps {
  agentId: string;
  dateRange: DateRange;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ConvData {
  total: number;
  completed: number;
  completionRate: number;
  avgDuration: number;
  avgMessages: number;
  volumeOverTime: { date: string; count: number }[];
  byDayOfWeek: { day: string; count: number }[];
  durationDist: { range: string; count: number }[];
  endReasonData: { name: string; value: number }[];
}

const END_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#6b7280"];

export function ConversationsAnalytics({ agentId, dateRange }: ConversationsAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConvData | null>(null);

  useEffect(() => { loadData(); }, [agentId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, status, started_at, ended_at, duration, metadata, department_id")
        .eq("agent_id", agentId)
        .gte("started_at", dateRange.from.toISOString())
        .lte("started_at", dateRange.to.toISOString());

      const conversations = convs || [];
      const total = conversations.length;
      const completed = conversations.filter(c => c.status === "resolved" || c.ended_at).length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      const durations = conversations.filter(c => c.duration && c.duration > 0).map(c => c.duration!);
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      let avgMessages = 0;
      const sampleIds = conversations.slice(0, 100).map(c => c.id);
      if (sampleIds.length > 0) {
        const { data: msgCounts } = await supabase
          .from("transcripts")
          .select("conversation_id")
          .in("conversation_id", sampleIds);
        if (msgCounts) {
          const countMap = new Map<string, number>();
          msgCounts.forEach(m => countMap.set(m.conversation_id, (countMap.get(m.conversation_id) || 0) + 1));
          const counts = Array.from(countMap.values());
          avgMessages = counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0;
        }
      }

      const dayMap = new Map<string, number>();
      for (const c of conversations) {
        if (!c.started_at) continue;
        const day = new Date(c.started_at).toISOString().split("T")[0];
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      const volumeOverTime = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const dowCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
      for (const c of conversations) {
        if (!c.started_at) continue;
        dowCounts[new Date(c.started_at).getDay()]++;
      }
      const byDayOfWeek = dowCounts.map((count, i) => ({ day: DAY_SHORT[i], count }));

      const durationBuckets: Record<string, number> = {
        "< 1 min": 0, "1-3 min": 0, "3-5 min": 0, "5-10 min": 0, "10-30 min": 0, "30+ min": 0,
      };
      for (const c of conversations) {
        const mins = (c.duration || 0) / 60;
        if (mins < 1) durationBuckets["< 1 min"]++;
        else if (mins < 3) durationBuckets["1-3 min"]++;
        else if (mins < 5) durationBuckets["3-5 min"]++;
        else if (mins < 10) durationBuckets["5-10 min"]++;
        else if (mins < 30) durationBuckets["10-30 min"]++;
        else durationBuckets["30+ min"]++;
      }
      const durationDist = Object.entries(durationBuckets).map(([range, count]) => ({ range, count }));

      const endReasons: Record<string, number> = {};
      for (const c of conversations) {
        const status = c.status || "active";
        const label = status === "resolved" ? "Resolved" : status === "with_ai" ? "Active (AI)" : status === "in_handover" ? "Active (Handover)" : status === "aftercare" ? "Aftercare" : status === "needs_review" ? "Needs Review" : status;
        endReasons[label] = (endReasons[label] || 0) + 1;
      }
      const endReasonData = Object.entries(endReasons).map(([name, value]) => ({ name, value }));

      setData({
        total, completed, completionRate, avgDuration, avgMessages,
        volumeOverTime, byDayOfWeek, durationDist, endReasonData,
      });
    } catch (e) {
      console.error("Error loading conversation analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}</div>;
  if (!data) return <p className="p-6 text-muted-foreground">No data available</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Conversations</p>
          <p className="text-2xl font-bold mt-1">{data.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Completion Rate</p>
          <p className="text-2xl font-bold mt-1">{data.completionRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{data.completed} completed</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Duration</p>
          <p className="text-2xl font-bold mt-1">{formatDuration(data.avgDuration)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Avg Messages</p>
          <p className="text-2xl font-bold mt-1">{data.avgMessages}</p>
          <p className="text-xs text-muted-foreground">per conversation</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Daily Volume</p>
          {data.volumeOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.volumeOverTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-10 text-center">No data</p>}
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">By Day of Week</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byDayOfWeek}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Duration Distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.durationDist}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Current Status</p>
          {data.endReasonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.endReasonData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.endReasonData.map((_: any, i: number) => <Cell key={i} fill={END_COLORS[i % END_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-10 text-center">No data</p>}
        </Card>
      </div>
    </div>
  );
}
