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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    fetchMetrics();
  }, [agentId, dateRange]);

  const fetchMetrics = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      // Fetch conversations within date range
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("agent_id", agentId)
        .gte("started_at", dateRange.from.toISOString())
        .lte("started_at", dateRange.to.toISOString());

      if (error) throw error;

      // Calculate metrics
      const totalConversations = conversations?.length || 0;
      const activeConversations = conversations?.filter(c => c.status === "active").length || 0;
      const completedConversations = conversations?.filter(c => c.status === "completed").length || 0;
      
      const durationsInSeconds = conversations
        ?.filter(c => c.duration)
        .map(c => c.duration) || [];
      
      const avgDuration = durationsInSeconds.length > 0
        ? Math.round(durationsInSeconds.reduce((a, b) => a + b, 0) / durationsInSeconds.length)
        : 0;

      // Group by status
      const conversationsByStatus = conversations?.reduce((acc: any, conv) => {
        const status = conv.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}) || {};

      // Group by tags
      const conversationsByTag = conversations?.reduce((acc: any, conv) => {
        const metadata = conv.metadata as any;
        const tags = metadata?.tags || [];
        tags.forEach((tag: string) => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
      }, {}) || {};

      // Group by sentiment
      const conversationsBySentiment = conversations?.reduce((acc: any, conv) => {
        const sentiment = conv.sentiment || "neutral";
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      }, {}) || {};

      // Time series data
      const conversationsOverTime = generateTimeSeriesData(conversations || [], dateRange);

      // Distribution by hour
      const conversationsByHour = conversations?.reduce((acc: any, conv) => {
        const hour = new Date(conv.started_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {}) || {};

      setMetrics({
        totalConversations,
        activeConversations,
        completedConversations,
        avgDuration,
        conversationsByStatus,
        conversationsByTag,
        conversationsBySentiment,
        conversationsOverTime,
        conversationsByHour,
        rawData: conversations
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refetch: fetchMetrics };
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
