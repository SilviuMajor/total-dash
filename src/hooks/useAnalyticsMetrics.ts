import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export type DateRangePreset = "day" | "week" | "30days" | "month" | "year" | "365days" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function useAnalyticsMetrics(agentId: string | null, dateRange: DateRange) {
  const [metrics, setMetrics] = useState<any>({});
  const [previousMetrics, setPreviousMetrics] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    fetchMetrics();
  }, [agentId, dateRange]);

  const fetchMetrics = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      // Calculate previous period date range
      const daysDiff = differenceInDays(dateRange.to, dateRange.from);
      const previousFrom = subDays(dateRange.from, daysDiff + 1);
      const previousTo = subDays(dateRange.to, daysDiff + 1);

      // Fetch current period conversations
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("agent_id", agentId)
        .gte("started_at", dateRange.from.toISOString())
        .lte("started_at", dateRange.to.toISOString());

      if (error) throw error;

      // Fetch previous period conversations for comparison
      const { data: previousConversations } = await supabase
        .from("conversations")
        .select("*")
        .eq("agent_id", agentId)
        .gte("started_at", previousFrom.toISOString())
        .lte("started_at", previousTo.toISOString());

      // Calculate current period metrics
      const currentMetrics = calculateMetrics(conversations || [], dateRange);
      const prevMetrics = calculateMetrics(previousConversations || [], { from: previousFrom, to: previousTo });

      setMetrics(currentMetrics);
      setPreviousMetrics(prevMetrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, previousMetrics, loading, refetch: fetchMetrics };
}

function calculateMetrics(conversations: any[], dateRange: DateRange) {
  const totalConversations = conversations.length;
  const activeConversations = conversations.filter(c => c.status === "active").length;
  const completedConversations = conversations.filter(c => c.status === "completed").length;
  
  const durationsInSeconds = conversations
    .filter(c => c.duration)
    .map(c => c.duration);
  
  const avgDuration = durationsInSeconds.length > 0
    ? Math.round(durationsInSeconds.reduce((a, b) => a + b, 0) / durationsInSeconds.length)
    : 0;

  // Group by status
  const conversationsByStatus = conversations.reduce((acc: any, conv) => {
    const status = conv.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Group by tags
  const conversationsByTag = conversations.reduce((acc: any, conv) => {
    const metadata = conv.metadata as any;
    const tags = metadata?.tags || [];
    tags.forEach((tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  // Group by sentiment
  const conversationsBySentiment = conversations.reduce((acc: any, conv) => {
    const sentiment = conv.sentiment || "neutral";
    acc[sentiment] = (acc[sentiment] || 0) + 1;
    return acc;
  }, {});

  // Group by department
  const conversationsByDepartment = conversations.reduce((acc: any, conv) => {
    const metadata = conv.metadata as any;
    const dept = metadata?.department || "Unassigned";
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  // Top tags (top 10)
  const topTags = Object.entries(conversationsByTag)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .reduce((acc, [tag, count]) => ({ ...acc, [tag]: count }), {});

  // Completion rate
  const completionRate = totalConversations > 0 
    ? Number(((completedConversations / totalConversations) * 100).toFixed(1))
    : 0;

  // Time series data
  const conversationsOverTime = generateTimeSeriesData(conversations, dateRange);

  // Distribution by hour
  const conversationsByHour = conversations.reduce((acc: any, conv) => {
    const hour = new Date(conv.started_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  // Peak usage time
  const peakHourEntry = Object.entries(conversationsByHour)
    .sort(([, a]: any, [, b]: any) => b - a)[0];
  const peakUsageTime = peakHourEntry ? `${peakHourEntry[0]}:00` : 'N/A';

  // Duration distribution
  const durationDistribution = conversations.reduce((acc: any, conv) => {
    const mins = (conv.duration || 0) / 60;
    if (mins < 1) acc['0-1 min'] = (acc['0-1 min'] || 0) + 1;
    else if (mins < 3) acc['1-3 min'] = (acc['1-3 min'] || 0) + 1;
    else if (mins < 5) acc['3-5 min'] = (acc['3-5 min'] || 0) + 1;
    else if (mins < 10) acc['5-10 min'] = (acc['5-10 min'] || 0) + 1;
    else acc['10+ min'] = (acc['10+ min'] || 0) + 1;
    return acc;
  }, {});

  return {
    totalConversations,
    activeConversations,
    completedConversations,
    avgDuration,
    completionRate,
    conversationsByStatus,
    conversationsByTag,
    conversationsBySentiment,
    conversationsByDepartment,
    topTags,
    conversationsOverTime,
    conversationsByHour,
    peakUsageTime,
    durationDistribution,
    rawData: conversations
  };
}


function generateTimeSeriesData(conversations: any[], dateRange: DateRange) {
  const days = differenceInDays(dateRange.to, dateRange.from) + 1;
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = subDays(dateRange.to, days - i - 1);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const count = conversations.filter(c => {
      const convDate = new Date(c.started_at);
      return convDate >= dayStart && convDate <= dayEnd;
    }).length;

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: date,
      count
    });
  }

  return data;
}

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();

  switch (preset) {
    case "day":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "30days":
      return { from: subDays(now, 30), to: now };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "365days":
      return { from: subDays(now, 365), to: now };
    default:
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
