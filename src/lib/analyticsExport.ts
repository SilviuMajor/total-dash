import { DateRange } from "@/hooks/useAnalyticsMetrics";
import { format } from "date-fns";

export interface ExportOptions {
  format: 'csv' | 'json';
  scope: 'current-tab' | 'all-tabs';
  tabName?: string;
  allTabsData?: Array<{ name: string; metrics: any }>;
  metrics: any;
  dateRange: DateRange;
  agentName: string;
}

export function exportAnalyticsData(options: ExportOptions): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const agentSlug = options.agentName.toLowerCase().replace(/\s+/g, '-');
  
  if (options.scope === 'current-tab') {
    const content = options.format === 'csv' 
      ? exportTabToCSV(options.tabName!, options.metrics, options.dateRange)
      : exportTabToJSON(options.tabName!, options.metrics, options.dateRange);
    
    const filename = `${agentSlug}_${options.tabName?.toLowerCase().replace(/\s+/g, '-')}_${timestamp}.${options.format}`;
    downloadFile(content, filename, options.format === 'csv' ? 'text/csv' : 'application/json');
  } else {
    const content = options.format === 'csv'
      ? exportAllTabsToCSV(options.allTabsData!, options.dateRange)
      : exportAllTabsToJSON(options.allTabsData!, options.dateRange);
    
    const filename = `${agentSlug}_all-tabs_${timestamp}.${options.format}`;
    downloadFile(content, filename, options.format === 'csv' ? 'text/csv' : 'application/json');
  }
}

function exportTabToCSV(tabName: string, metrics: any, dateRange: DateRange): string {
  const dateRangeStr = formatDateRange(dateRange);
  
  const rows: string[][] = [
    ['Tab', 'Metric', 'Value', 'Date Range'],
    [tabName, 'Total Conversations', metrics.totalConversations?.toString() || '0', dateRangeStr],
    [tabName, 'Active Conversations', metrics.activeConversations?.toString() || '0', dateRangeStr],
    [tabName, 'Completed Conversations', metrics.completedConversations?.toString() || '0', dateRangeStr],
    [tabName, 'Average Duration', formatDuration(metrics.avgDuration || 0), dateRangeStr],
  ];

  // Add completion rate if available
  if (metrics.completionRate !== undefined) {
    rows.push([tabName, 'Completion Rate', `${metrics.completionRate}%`, dateRangeStr]);
  }

  // Add status breakdown
  if (metrics.conversationsByStatus) {
    Object.entries(metrics.conversationsByStatus).forEach(([status, count]) => {
      rows.push([tabName, `Status: ${status}`, count?.toString() || '0', dateRangeStr]);
    });
  }

  // Add sentiment breakdown
  if (metrics.conversationsBySentiment) {
    Object.entries(metrics.conversationsBySentiment).forEach(([sentiment, count]) => {
      rows.push([tabName, `Sentiment: ${sentiment}`, count?.toString() || '0', dateRangeStr]);
    });
  }

  // Add top tags
  if (metrics.topTags) {
    Object.entries(metrics.topTags).slice(0, 10).forEach(([tag, count]) => {
      rows.push([tabName, `Tag: ${tag}`, count?.toString() || '0', dateRangeStr]);
    });
  }

  // Add peak usage
  if (metrics.peakUsageTime) {
    rows.push([tabName, 'Peak Usage Time', metrics.peakUsageTime, dateRangeStr]);
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function exportTabToJSON(tabName: string, metrics: any, dateRange: DateRange): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    dateRange: formatDateRange(dateRange),
    tab: tabName,
    metrics: {
      totalConversations: metrics.totalConversations || 0,
      activeConversations: metrics.activeConversations || 0,
      completedConversations: metrics.completedConversations || 0,
      avgDuration: metrics.avgDuration || 0,
      avgDurationFormatted: formatDuration(metrics.avgDuration || 0),
      completionRate: metrics.completionRate,
      conversationsByStatus: metrics.conversationsByStatus || {},
      conversationsBySentiment: metrics.conversationsBySentiment || {},
      conversationsByTag: metrics.conversationsByTag || {},
      conversationsByHour: metrics.conversationsByHour || {},
      topTags: metrics.topTags || {},
      peakUsageTime: metrics.peakUsageTime,
      durationDistribution: metrics.durationDistribution || {},
      conversationsOverTime: metrics.conversationsOverTime || [],
    }
  }, null, 2);
}

function exportAllTabsToCSV(tabsData: Array<{ name: string; metrics: any }>, dateRange: DateRange): string {
  const dateRangeStr = formatDateRange(dateRange);
  
  const rows: string[][] = [
    ['Tab', 'Metric', 'Value', 'Date Range']
  ];

  tabsData.forEach(({ name, metrics }) => {
    rows.push([name, 'Total Conversations', metrics.totalConversations?.toString() || '0', dateRangeStr]);
    rows.push([name, 'Active Conversations', metrics.activeConversations?.toString() || '0', dateRangeStr]);
    rows.push([name, 'Completed Conversations', metrics.completedConversations?.toString() || '0', dateRangeStr]);
    rows.push([name, 'Average Duration', formatDuration(metrics.avgDuration || 0), dateRangeStr]);
    
    if (metrics.completionRate !== undefined) {
      rows.push([name, 'Completion Rate', `${metrics.completionRate}%`, dateRangeStr]);
    }
  });

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function exportAllTabsToJSON(tabsData: Array<{ name: string; metrics: any }>, dateRange: DateRange): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    dateRange: formatDateRange(dateRange),
    tabs: tabsData.map(({ name, metrics }) => ({
      name,
      metrics: {
        totalConversations: metrics.totalConversations || 0,
        activeConversations: metrics.activeConversations || 0,
        completedConversations: metrics.completedConversations || 0,
        avgDuration: metrics.avgDuration || 0,
        avgDurationFormatted: formatDuration(metrics.avgDuration || 0),
        completionRate: metrics.completionRate,
        conversationsByStatus: metrics.conversationsByStatus || {},
        conversationsBySentiment: metrics.conversationsBySentiment || {},
      }
    }))
  }, null, 2);
}

function formatDateRange(dateRange: DateRange): string {
  return `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
}

function formatDuration(seconds: number): string {
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

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
