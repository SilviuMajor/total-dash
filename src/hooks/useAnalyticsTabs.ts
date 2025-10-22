import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AnalyticsTab {
  id: string;
  agent_id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  default_date_range: string;
  created_at: string;
  updated_at: string;
}

export function useAnalyticsTabs(agentId: string | null) {
  const [tabs, setTabs] = useState<AnalyticsTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch tabs
  useEffect(() => {
    if (!agentId) {
      setTabs([]);
      setActiveTabId(null);
      setLoading(false);
      return;
    }

    fetchTabs();
  }, [agentId]);

  const fetchTabs = async () => {
    if (!agentId) return;

    try {
      const { data, error } = await supabase
        .from("analytics_tabs")
        .select("*")
        .eq("agent_id", agentId)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Create default "Home" tab
        await createDefaultTab();
      } else {
        setTabs(data);
        const defaultTab = data.find(t => t.is_default) || data[0];
        setActiveTabId(defaultTab.id);
      }
    } catch (error) {
      console.error("Error fetching tabs:", error);
      toast.error("Failed to load analytics tabs");
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTab = async () => {
    if (!agentId) return;

    try {
      const { data, error } = await supabase
        .from("analytics_tabs")
        .insert({
          agent_id: agentId,
          name: "Home",
          sort_order: 0,
          is_default: true,
          default_date_range: "week"
        })
        .select()
        .single();

      if (error) throw error;

      setTabs([data]);
      setActiveTabId(data.id);

      // Create default cards for Home tab
      await createDefaultCards(data.id);
    } catch (error) {
      console.error("Error creating default tab:", error);
    }
  };

  const createDefaultCards = async (tabId: string) => {
    const defaultCards = [
      {
        tab_id: tabId,
        card_type: "metric",
        metric_type: "total_conversations",
        title: "Total Conversations",
        grid_position: { x: 0, y: 0, w: 3, h: 2 },
        config: {}
      },
      {
        tab_id: tabId,
        card_type: "metric",
        metric_type: "avg_duration",
        title: "Avg Duration",
        grid_position: { x: 3, y: 0, w: 3, h: 2 },
        config: {}
      },
      {
        tab_id: tabId,
        card_type: "metric",
        metric_type: "active_conversations",
        title: "Active Conversations",
        grid_position: { x: 6, y: 0, w: 3, h: 2 },
        config: {}
      },
      {
        tab_id: tabId,
        card_type: "chart",
        metric_type: "conversations_over_time",
        title: "Conversations Over Time",
        grid_position: { x: 0, y: 2, w: 6, h: 4 },
        config: { chartType: "line" }
      },
      {
        tab_id: tabId,
        card_type: "chart",
        metric_type: "conversations_by_status",
        title: "Conversations by Status",
        grid_position: { x: 6, y: 2, w: 6, h: 4 },
        config: { chartType: "pie" }
      }
    ];

    await supabase.from("analytics_cards").insert(defaultCards);
  };

  const createTab = async (name: string) => {
    if (!agentId) return;

    try {
      const maxOrder = tabs.length > 0 ? Math.max(...tabs.map(t => t.sort_order)) : -1;

      const { data, error } = await supabase
        .from("analytics_tabs")
        .insert({
          agent_id: agentId,
          name,
          sort_order: maxOrder + 1,
          is_default: false,
          default_date_range: "week"
        })
        .select()
        .single();

      if (error) throw error;

      setTabs([...tabs, data]);
      setActiveTabId(data.id);
      toast.success("Tab created successfully");
    } catch (error) {
      console.error("Error creating tab:", error);
      toast.error("Failed to create tab");
    }
  };

  const updateTab = async (tabId: string, updates: Partial<AnalyticsTab>) => {
    try {
      const { error } = await supabase
        .from("analytics_tabs")
        .update(updates)
        .eq("id", tabId);

      if (error) throw error;

      setTabs(tabs.map(t => t.id === tabId ? { ...t, ...updates } : t));
      toast.success("Tab updated successfully");
    } catch (error) {
      console.error("Error updating tab:", error);
      toast.error("Failed to update tab");
    }
  };

  const deleteTab = async (tabId: string) => {
    if (tabs.length <= 1) {
      toast.error("Cannot delete the last tab");
      return;
    }

    try {
      const { error } = await supabase
        .from("analytics_tabs")
        .delete()
        .eq("id", tabId);

      if (error) throw error;

      const remainingTabs = tabs.filter(t => t.id !== tabId);
      setTabs(remainingTabs);
      
      if (activeTabId === tabId) {
        setActiveTabId(remainingTabs[0]?.id || null);
      }

      toast.success("Tab deleted successfully");
    } catch (error) {
      console.error("Error deleting tab:", error);
      toast.error("Failed to delete tab");
    }
  };

  const reorderTabs = async (newTabs: AnalyticsTab[]) => {
    setTabs(newTabs);

    try {
      const updates = newTabs.map((tab, index) => ({
        id: tab.id,
        sort_order: index
      }));

      for (const update of updates) {
        await supabase
          .from("analytics_tabs")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }
    } catch (error) {
      console.error("Error reordering tabs:", error);
      toast.error("Failed to reorder tabs");
    }
  };

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    loading,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs
  };
}
