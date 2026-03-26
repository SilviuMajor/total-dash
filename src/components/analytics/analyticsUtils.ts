import { differenceInDays } from "date-fns";

export type TimeGranularity = "hourly" | "daily" | "weekly" | "monthly";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getGranularity(dateRange: DateRange): TimeGranularity {
  const days = differenceInDays(dateRange.to, dateRange.from);
  if (days <= 1) return "hourly";
  if (days <= 60) return "daily";
  if (days <= 180) return "weekly";
  return "monthly";
}

export function aggregateByGranularity(
  items: { date: Date }[],
  granularity: TimeGranularity
): { label: string; count: number }[] {
  const map = new Map<string, number>();

  for (const item of items) {
    let key: string;
    const d = item.date;

    switch (granularity) {
      case "hourly":
        key = `${d.getHours().toString().padStart(2, "0")}:00`;
        break;
      case "daily":
        key = d.toISOString().split("T")[0];
        break;
      case "weekly": {
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        key = "w/" + monday.toISOString().split("T")[0];
        break;
      }
      case "monthly":
        key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        break;
    }

    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formatTickLabel(label: string, granularity: TimeGranularity): string {
  switch (granularity) {
    case "hourly":
      return label;
    case "daily":
      return new Date(label).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    case "weekly":
      return new Date(label.replace("w/", "")).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    case "monthly":
      return new Date(label + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }
}

export function getVolumeChartTitle(granularity: TimeGranularity): string {
  switch (granularity) {
    case "hourly": return "Activity by Hour";
    case "daily": return "Daily Volume";
    case "weekly": return "Weekly Volume";
    case "monthly": return "Monthly Volume";
  }
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function shouldShowDayOfWeek(dateRange: DateRange): boolean {
  return differenceInDays(dateRange.to, dateRange.from) >= 7;
}
