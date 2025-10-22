import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange, DateRangePreset, getDateRangeFromPreset } from "@/hooks/useAnalyticsMetrics";

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  defaultPreset?: DateRangePreset;
  onPresetChange?: (preset: DateRangePreset) => void;
}

const presets: { value: DateRangePreset; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "30days", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "365days", label: "Last 365 Days" },
  { value: "custom", label: "Custom Range" }
];

export function DateRangeSelector({ value, onChange, defaultPreset = "week", onPresetChange }: DateRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(defaultPreset);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePresetChange = (preset: DateRangePreset) => {
    setSelectedPreset(preset);
    onPresetChange?.(preset);

    if (preset !== "custom") {
      const newRange = getDateRangeFromPreset(preset);
      onChange(newRange);
      setIsCustomOpen(false);
    } else {
      setIsCustomOpen(true);
    }
  };

  const handleCustomDateChange = (date: Date | undefined, isFrom: boolean) => {
    if (!date) return;

    const newRange = {
      from: isFrom ? date : value.from,
      to: isFrom ? value.to : date
    };

    onChange(newRange);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map(preset => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPreset === "custom" && (
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {value.from && value.to ? (
                <>
                  {format(value.from, "MMM d")} - {format(value.to, "MMM d, yyyy")}
                </>
              ) : (
                "Pick dates"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-sm font-medium mb-2">From</p>
                <Calendar
                  mode="single"
                  selected={value.from}
                  onSelect={(date) => handleCustomDateChange(date, true)}
                  disabled={(date) => date > new Date() || date > value.to}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">To</p>
                <Calendar
                  mode="single"
                  selected={value.to}
                  onSelect={(date) => handleCustomDateChange(date, false)}
                  disabled={(date) => date > new Date() || date < value.from}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
