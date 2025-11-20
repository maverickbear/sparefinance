"use client";

import * as React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange as DateRangeType } from "react-day-picker";

export type DateRangePreset = 
  | "all-dates"
  | "today"
  | "past-7-days"
  | "past-15-days"
  | "past-30-days"
  | "past-90-days"
  | "last-3-months"
  | "last-month"
  | "last-6-months"
  | "past-6-months"
  | "this-month"
  | "this-year"
  | "year-to-date"
  | "last-year"
  | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRangePreset | "custom";
  dateRange?: DateRange;
  onValueChange: (preset: DateRangePreset | "custom", range?: DateRange) => void;
  className?: string;
}

export function DateRangePicker({
  value,
  dateRange,
  onValueChange,
  className,
}: DateRangePickerProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<DateRangeType | undefined>(
    dateRange ? {
      from: new Date(dateRange.startDate),
      to: new Date(dateRange.endDate),
    } : undefined
  );
  const [previousValue, setPreviousValue] = React.useState<DateRangePreset | "custom">("this-month");

  // Update custom dates when dateRange prop changes
  React.useEffect(() => {
    if (value === "custom" && dateRange) {
      setSelectedRange({
        from: new Date(dateRange.startDate),
        to: new Date(dateRange.endDate),
      });
    }
  }, [dateRange, value]);

  const getDisplayText = () => {
    if (value === "custom" && dateRange) {
      try {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
      } catch {
        return "Custom range";
      }
    }

    const presetLabels: Record<DateRangePreset, string> = {
      "all-dates": "All Dates",
      today: "Today",
      "past-7-days": "Past 7 days",
      "past-15-days": "Past 15 days",
      "past-30-days": "Past 30 days",
      "past-90-days": "Past 90 days",
      "last-3-months": "Last 3 months",
      "last-month": "Last month",
      "last-6-months": "Last 6 months",
      "past-6-months": "Past 6 months",
      "this-month": "This month",
      "this-year": "This year",
      "year-to-date": "Year to date",
      "last-year": "Last year",
      custom: "Custom range",
    };

    return presetLabels[value as DateRangePreset] || "Select date range";
  };

  const handlePresetChange = (preset: string) => {
    if (preset === "custom") {
      // Save the current value before switching to custom
      if (value !== "custom") {
        setPreviousValue(value);
      }
      // Change to custom and open popover
      onValueChange("custom");
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
      onValueChange(preset as DateRangePreset);
    }
  };

  const handleRangeSelect = (range: DateRangeType | undefined) => {
    setSelectedRange(range);
    
    // Auto-apply when both dates are selected
    if (range?.from && range?.to) {
      const startDate = format(range.from, "yyyy-MM-dd");
      const endDate = format(range.to, "yyyy-MM-dd");
      
      const dateRange: DateRange = {
        startDate,
        endDate,
      };
      onValueChange("custom", dateRange);
      setIsPopoverOpen(false);
    }
  };

  const handleCancel = () => {
    // Reset to previous values
    if (dateRange) {
      setSelectedRange({
        from: new Date(dateRange.startDate),
        to: new Date(dateRange.endDate),
      });
    } else {
      setSelectedRange(undefined);
    }
    setIsPopoverOpen(false);
    // Revert to the previous value if user cancelled
    if (value === "custom" && !dateRange) {
      onValueChange(previousValue);
    }
  };

  const selectTriggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <div className={cn("flex items-center gap-2", className)}>
        <Select 
          value={value} 
          onValueChange={handlePresetChange}
        >
          <PopoverTrigger asChild>
            <SelectTrigger 
              ref={selectTriggerRef}
              className="h-9 w-auto min-w-[140px] text-xs"
            >
              <SelectValue>{getDisplayText()}</SelectValue>
            </SelectTrigger>
          </PopoverTrigger>
          <SelectContent>
            <SelectItem value="all-dates">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="past-7-days">Past 7 days</SelectItem>
            <SelectItem value="past-15-days">Past 15 days</SelectItem>
            <SelectItem value="past-30-days">Past 30 days</SelectItem>
            <SelectItem value="past-90-days">Past 90 days</SelectItem>
            <SelectItem value="last-3-months">Last 3 months</SelectItem>
            <SelectItem value="last-month">Last month</SelectItem>
            <SelectItem value="last-6-months">Last 6 months</SelectItem>
            <SelectItem value="past-6-months">Past 6 months</SelectItem>
            <SelectItem value="this-month">This month</SelectItem>
            <SelectItem value="this-year">This year</SelectItem>
            <SelectItem value="year-to-date">Year to date</SelectItem>
            <SelectItem value="last-year">Last year</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            className="rounded-md border"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="small"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

