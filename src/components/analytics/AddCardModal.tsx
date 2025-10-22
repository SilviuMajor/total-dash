import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cardData: NewCardData) => void;
  tabId: string;
}

export interface NewCardData {
  tab_id: string;
  title: string;
  metric_type: string;
  card_type: "metric" | "chart";
  chart_type?: "line" | "bar" | "pie" | "area";
  grid_position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

const metricOptions = [
  { value: "total_conversations", label: "Total Conversations", description: "Total number of conversations" },
  { value: "active_conversations", label: "Active Conversations", description: "Currently active conversations" },
  { value: "completed_conversations", label: "Completed Conversations", description: "Successfully completed conversations" },
  { value: "avg_duration", label: "Average Duration", description: "Average conversation duration" },
  { value: "conversations_over_time", label: "Conversations Over Time", description: "Time series of conversation volume" },
  { value: "conversations_by_status", label: "Conversations by Status", description: "Breakdown by status" },
  { value: "conversations_by_tag", label: "Conversations by Tag", description: "Most common conversation tags" },
  { value: "conversations_by_hour", label: "Conversations by Hour", description: "Distribution by hour of day" },
  { value: "conversations_by_sentiment", label: "Conversations by Sentiment", description: "Sentiment distribution" },
  { value: "conversations_by_department", label: "Conversations by Department", description: "Distribution by department" },
  { value: "completion_rate", label: "Completion Rate", description: "Percentage of completed conversations" },
  { value: "top_tags", label: "Top Tags", description: "Most frequently used tags" },
  { value: "peak_usage", label: "Peak Usage Time", description: "Busiest hour of the day" },
  { value: "duration_distribution", label: "Duration Distribution", description: "Conversation length distribution" },
];

export function AddCardModal({ isOpen, onClose, onSubmit, tabId }: AddCardModalProps) {
  const [cardType, setCardType] = useState<"metric" | "chart">("metric");
  const [metricType, setMetricType] = useState<string>("");
  const [chartType, setChartType] = useState<"line" | "bar" | "pie" | "area">("line");
  const [title, setTitle] = useState<string>("");

  const handleSubmit = () => {
    if (!metricType) return;

    const selectedMetric = metricOptions.find(m => m.value === metricType);
    const cardTitle = title || selectedMetric?.label || "New Card";

    const newCard: NewCardData = {
      tab_id: tabId,
      title: cardTitle,
      metric_type: metricType,
      card_type: cardType,
      chart_type: cardType === "chart" ? chartType : undefined,
      grid_position: {
        x: 0,
        y: 0,
        w: cardType === "metric" ? 3 : 6,
        h: cardType === "metric" ? 2 : 4,
      },
    };

    onSubmit(newCard);
    handleClose();
  };

  const handleClose = () => {
    setCardType("metric");
    setMetricType("");
    setChartType("line");
    setTitle("");
    onClose();
  };

  const selectedMetric = metricOptions.find(m => m.value === metricType);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Analytics Card</DialogTitle>
          <DialogDescription>
            Choose a metric to display on your analytics dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Card Type Selection */}
          <div className="space-y-3">
            <Label>Card Type</Label>
            <RadioGroup value={cardType} onValueChange={(v) => setCardType(v as "metric" | "chart")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="metric" id="metric" />
                <Label htmlFor="metric" className="font-normal cursor-pointer">
                  Metric Card - Display a single value with trend indicator
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="chart" id="chart" />
                <Label htmlFor="chart" className="font-normal cursor-pointer">
                  Chart Card - Display data in a visual chart
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Metric Selection */}
          <div className="space-y-2">
            <Label htmlFor="metric-type">Metric</Label>
            <Select value={metricType} onValueChange={setMetricType}>
              <SelectTrigger id="metric-type">
                <SelectValue placeholder="Select a metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMetric && (
              <p className="text-sm text-muted-foreground">{selectedMetric.description}</p>
            )}
          </div>

          {/* Chart Type Selection (only for charts) */}
          {cardType === "chart" && (
            <div className="space-y-2">
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
                <SelectTrigger id="chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Custom Title (Optional)</Label>
            <Input
              id="title"
              placeholder={selectedMetric?.label || "Enter card title"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Preview */}
          {metricType && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="bg-card rounded-md p-4 border">
                <p className="font-semibold">{title || selectedMetric?.label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {cardType === "metric" ? "Metric value will be displayed here" : `${chartType} chart will be displayed here`}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!metricType}>
            Add Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
