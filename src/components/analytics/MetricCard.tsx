import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Maximize2, Minimize2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDuration } from "@/hooks/useAnalyticsMetrics";
import { cn } from "@/lib/utils";

export interface AnalyticsCardData {
  id: string;
  card_type: "metric" | "chart" | "table";
  metric_type: string;
  title: string;
  config: any;
  is_expanded: boolean;
}

interface MetricCardProps {
  card: AnalyticsCardData;
  metrics: any;
  onToggleExpand: (cardId: string) => void;
  onDelete?: (cardId: string) => void;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))"
];

export function MetricCard({ card, metrics, onToggleExpand, onDelete }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const renderMetricValue = () => {
    switch (card.metric_type) {
      case "total_conversations":
        return metrics.totalConversations || 0;
      case "active_conversations":
        return metrics.activeConversations || 0;
      case "completed_conversations":
        return metrics.completedConversations || 0;
      case "avg_duration":
        return formatDuration(metrics.avgDuration || 0);
      default:
        return "N/A";
    }
  };

  const renderTrend = () => {
    // TODO: Calculate trend based on previous period
    const trend = Math.random() > 0.5 ? "up" : "down";
    const percentage = Math.floor(Math.random() * 20) + 1;

    if (trend === "up") {
      return (
        <div className="flex items-center gap-1 text-success text-sm">
          <TrendingUp className="h-4 w-4" />
          <span>+{percentage}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-destructive text-sm">
          <TrendingDown className="h-4 w-4" />
          <span>-{percentage}%</span>
        </div>
      );
    }
  };

  const renderChart = () => {
    const chartType = card.config?.chartType || "line";

    switch (card.metric_type) {
      case "conversations_over_time":
        const timeData = metrics.conversationsOverTime || [];
        
        if (chartType === "area") {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          );
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "conversations_by_status":
        const statusData = Object.entries(metrics.conversationsByStatus || {}).map(([name, value]) => ({ name, value }));

        if (chartType === "pie") {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          );
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "conversations_by_tag":
        const tagData = Object.entries(metrics.conversationsByTag || {}).map(([name, value]) => ({ name, value }));
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tagData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={100} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
              <Bar dataKey="value" fill="hsl(var(--success))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "conversations_by_hour":
        const hourData = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}h`,
          count: metrics.conversationsByHour?.[i] || 0
        }));

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }} />
              <Bar dataKey="count" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="flex items-center justify-center h-full text-muted-foreground">No chart available</div>;
    }
  };

  const renderContent = () => {
    if (card.card_type === "chart" || (card.card_type === "metric" && card.is_expanded)) {
      return (
        <div className="h-full w-full p-4">
          {renderChart()}
        </div>
      );
    }

    // Metric card view
    return (
      <div className="flex flex-col justify-between h-full p-6">
        <div className="space-y-2">
          <div className="text-5xl font-bold text-foreground">{renderMetricValue()}</div>
          {renderTrend()}
        </div>
      </div>
    );
  };

  return (
    <Card
      className={cn(
        "bg-gradient-card border-border/50 hover:border-primary/50 transition-all relative overflow-hidden h-full",
        isHovered && "shadow-lg"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
        <div className="flex items-center gap-1">
          {card.card_type === "metric" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onToggleExpand(card.id)}
            >
              {card.is_expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      <div className={cn(
        "overflow-hidden",
        card.card_type === "chart" || card.is_expanded ? "h-[calc(100%-60px)]" : "h-auto"
      )}>
        {renderContent()}
      </div>
    </Card>
  );
}
