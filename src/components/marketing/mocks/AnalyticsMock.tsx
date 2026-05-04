import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type KPI = { label: string; value: string; delta: string; trend: "up" | "down" | "flat" };

const KPIS: KPI[] = [
  { label: "Conversations", value: "4,128", delta: "+12.4%", trend: "up" },
  { label: "Handover rate", value: "21%", delta: "−1.8 pp", trend: "down" },
  { label: "Avg. time-to-human", value: "00:37", delta: "+3s", trend: "flat" },
  { label: "Resolution rate", value: "94%", delta: "+0.6 pp", trend: "up" },
];

// Simple sparkline points (0–100 scale, 14 days).
const SPARK = [62, 58, 64, 61, 70, 73, 68, 72, 78, 81, 76, 84, 88, 91];

export const AnalyticsMock = () => {
  const max = Math.max(...SPARK);
  const min = Math.min(...SPARK);
  const path = SPARK
    .map((v, i) => {
      const x = (i / (SPARK.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min)) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-xs font-semibold text-foreground">Analytics · last 14 days</span>
        <div className="flex gap-1">
          {(["7d", "14d", "30d", "Custom"] as const).map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-medium",
                i === 1 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
        {KPIS.map((k) => (
          <div key={k.label} className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground marketing-tnum">{k.value}</div>
            <div
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium",
                k.trend === "up" && "text-foreground",
                k.trend === "down" && "text-muted-foreground",
                k.trend === "flat" && "text-muted-foreground/70"
              )}
            >
              {k.trend === "up" && <TrendingUp className="h-3 w-3" />}
              {k.trend === "down" && <TrendingDown className="h-3 w-3" />}
              {k.trend === "flat" && <Minus className="h-3 w-3" />}
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Resolutions per day
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-24 w-full">
          <defs>
            <linearGradient id="mk-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L100,100 L0,100 Z`} fill="url(#mk-spark-fill)" />
          <path d={path} fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground marketing-tnum">
          <span>21 Apr</span>
          <span>04 May</span>
        </div>
      </div>
    </div>
  );
};
