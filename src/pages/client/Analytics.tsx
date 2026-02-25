import { useState, useEffect } from "react";
import { AnalyticsSkeleton } from "@/components/skeletons";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { AnalyticsTabBar } from "@/components/analytics/AnalyticsTabBar";
import { DateRangeSelector } from "@/components/analytics/DateRangeSelector";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { useAnalyticsTabs } from "@/hooks/useAnalyticsTabs";
import { useAnalyticsMetrics, DateRange, getDateRangeFromPreset, DateRangePreset } from "@/hooks/useAnalyticsMetrics";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Edit, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportAnalyticsData } from "@/lib/analyticsExport";
import { toast } from "sonner";

export default function Analytics() {
  const { agents, selectedAgentId } = useClientAgentContext();
  const { profile } = useAuth();
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
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { metrics, loading: metricsLoading } = useAnalyticsMetrics(selectedAgent?.id || null, dateRange);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isAdmin = profile?.role === 'admin';

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

  const handleExport = (scope: 'current-tab' | 'all-tabs', format: 'csv' | 'json') => {
    try {
      if (scope === 'current-tab') {
        exportAnalyticsData({
          format,
          scope,
          tabName: activeTab?.name || 'Analytics',
          metrics,
          dateRange,
          agentName: selectedAgent?.name || 'Agent',
        });
      } else {
        const allTabsData = tabs.map(tab => ({
          name: tab.name,
          metrics,
        }));
        exportAnalyticsData({
          format,
          scope,
          allTabsData,
          metrics,
          dateRange,
          agentName: selectedAgent?.name || 'Agent',
        });
      }
      toast.success(`Analytics data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export analytics data');
      console.error('Export error:', error);
    }
  };

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  if (tabsLoading) {
    return (
      <div className="p-2">
        <AnalyticsSkeleton />
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
          <div className="flex items-center gap-3">
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              defaultPreset={currentPreset}
              onPresetChange={handlePresetChange}
            />
            {isAdmin && (
              <>
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditMode ? "Done" : "Edit"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('current-tab', 'csv')}>
                      Current Tab (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('current-tab', 'json')}>
                      Current Tab (JSON)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport('all-tabs', 'csv')}>
                      All Tabs (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('all-tabs', 'json')}>
                      All Tabs (JSON)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
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
            isEditMode={isEditMode}
          />
        </div>
      )}
    </div>
  );
}
