import { useState, useEffect } from "react";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { AnalyticsTabBar } from "@/components/analytics/AnalyticsTabBar";
import { DateRangeSelector } from "@/components/analytics/DateRangeSelector";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { useAnalyticsTabs } from "@/hooks/useAnalyticsTabs";
import { useAnalyticsMetrics, DateRange, getDateRangeFromPreset, DateRangePreset } from "@/hooks/useAnalyticsMetrics";

export default function Analytics() {
  const { agents, selectedAgentId } = useClientAgentContext();
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    loading: tabsLoading,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs
  } = useAnalyticsTabs(selectedAgent?.id || null);

  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset("week"));
  const [currentPreset, setCurrentPreset] = useState<DateRangePreset>("week");
  
  const { metrics, loading: metricsLoading } = useAnalyticsMetrics(selectedAgent?.id || null, dateRange);

  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (activeTab?.default_date_range) {
      const preset = activeTab.default_date_range as DateRangePreset;
      setCurrentPreset(preset);
      setDateRange(getDateRangeFromPreset(preset));
    }
  }, [activeTab]);

  const handlePresetChange = (preset: DateRangePreset) => {
    setCurrentPreset(preset);
    if (activeTabId) {
      updateTab(activeTabId, { default_date_range: preset });
    }
  };

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  if (tabsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 p-6 pb-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground">Deep dive into your AI agent performance metrics.</p>
          </div>
          <div className="flex items-center gap-4">
            <ClientAgentSelector />
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              defaultPreset={currentPreset}
              onPresetChange={handlePresetChange}
            />
          </div>
        </div>
      </div>

      <AnalyticsTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabCreate={createTab}
        onTabRename={(id, name) => updateTab(id, { name })}
        onTabDelete={deleteTab}
        onTabReorder={reorderTabs}
      />

      {activeTabId && (
        <div className="flex-1 overflow-auto">
          <AnalyticsDashboard
            tabId={activeTabId}
            metrics={metrics}
          />
        </div>
      )}
    </div>
  );
}
