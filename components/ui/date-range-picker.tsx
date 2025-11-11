"use client";

import * as React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [customStartDate, setCustomStartDate] = React.useState(
    dateRange?.startDate || ""
  );
  const [customEndDate, setCustomEndDate] = React.useState(
    dateRange?.endDate || ""
  );
  const [error, setError] = React.useState<string>("");
  const [previousValue, setPreviousValue] = React.useState<DateRangePreset | "custom">("this-month");

  // Update custom dates when dateRange prop changes
  React.useEffect(() => {
    if (value === "custom" && dateRange) {
      setCustomStartDate(dateRange.startDate);
      setCustomEndDate(dateRange.endDate);
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

  const validateDateInput = (value: string): boolean => {
    // Check if the value matches YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return false;
    }
    
    // Check if the date is valid
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // Check if the year has exactly 4 digits
    const [year] = value.split('-');
    if (year.length !== 4) {
      return false;
    }
    
    return true;
  };

  const handleDateChange = (
    value: string,
    setter: (value: string) => void
  ) => {
    // If empty, allow it (user might be clearing the field)
    if (!value) {
      setter(value);
      setError("");
      return;
    }
    
    // Validate the format
    if (validateDateInput(value)) {
      setter(value);
      setError("");
    } else {
      // Still update the value but show error
      setter(value);
      setError("Please enter a valid date in YYYY-MM-DD format");
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      setError("Please select both start and end dates");
      return;
    }

    // Validate both dates
    if (!validateDateInput(customStartDate)) {
      setError("Please enter a valid start date in YYYY-MM-DD format");
      return;
    }

    if (!validateDateInput(customEndDate)) {
      setError("Please enter a valid end date in YYYY-MM-DD format");
      return;
    }

    const start = new Date(customStartDate);
    const end = new Date(customEndDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError("Please enter valid dates");
      return;
    }

    if (start > end) {
      setError("Start date must be before end date");
      return;
    }

    setError("");
    const range: DateRange = {
      startDate: customStartDate,
      endDate: customEndDate,
    };
    onValueChange("custom", range);
    setIsPopoverOpen(false);
  };

  const handleCancel = () => {
    // Reset to previous values
    if (dateRange) {
      setCustomStartDate(dateRange.startDate);
      setCustomEndDate(dateRange.endDate);
    } else {
      // If no previous custom range, reset to empty
      setCustomStartDate("");
      setCustomEndDate("");
    }
    setError("");
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
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  handleDateChange(e.target.value, setCustomStartDate);
                }}
                max="9999-12-31"
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  handleDateChange(e.target.value, setCustomEndDate);
                }}
                max="9999-12-31"
                className="w-full"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="small"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="small"
              onClick={handleApplyCustomRange}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

