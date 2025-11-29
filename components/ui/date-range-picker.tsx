"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateInput } from "@/src/infrastructure/utils/timestamp";

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
  const [startDateValue, setStartDateValue] = React.useState(
    dateRange ? formatDateInput(new Date(dateRange.startDate)) : ""
  );
  const [endDateValue, setEndDateValue] = React.useState(
    dateRange ? formatDateInput(new Date(dateRange.endDate)) : ""
  );

  // Update custom dates when dateRange prop changes
  React.useEffect(() => {
    if (value === "custom" && dateRange) {
      setStartDateValue(formatDateInput(new Date(dateRange.startDate)));
      setEndDateValue(formatDateInput(new Date(dateRange.endDate)));
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
      // Change to custom mode
      onValueChange("custom");
    } else {
      onValueChange(preset as DateRangePreset);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartDateValue(value);
    
    if (value && endDateValue) {
      const startDate = value;
      const endDate = endDateValue;
      
      // Validate that start date is before end date
      if (startDate <= endDate) {
        const dateRange: DateRange = {
          startDate,
          endDate,
        };
        onValueChange("custom", dateRange);
      }
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndDateValue(value);
    
    if (startDateValue && value) {
      const startDate = startDateValue;
      const endDate = value;
      
      // Validate that start date is before end date
      if (startDate <= endDate) {
        const dateRange: DateRange = {
          startDate,
          endDate,
        };
        onValueChange("custom", dateRange);
      }
    }
  };


  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select 
        value={value} 
        onValueChange={handlePresetChange}
      >
        <SelectTrigger 
          className="h-9 w-auto min-w-[140px] text-xs"
        >
          <SelectValue>{getDisplayText()}</SelectValue>
        </SelectTrigger>
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

      {value === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDateValue}
            onChange={handleStartDateChange}
            placeholder="Start date"
            className="h-9 text-xs"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={endDateValue}
            onChange={handleEndDateChange}
            placeholder="End date"
            className="h-9 text-xs"
            min={startDateValue || undefined}
          />
        </div>
      )}
    </div>
  );
}

