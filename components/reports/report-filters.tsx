"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { DateRangePicker, type DateRangePreset, type DateRange } from "@/components/ui/date-range-picker";

export type ReportPeriod = 
  | "current-month"
  | "last-3-months"
  | "last-6-months"
  | "last-12-months"
  | "year-to-date"
  | "custom";

export interface ReportFiltersProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
}

export function ReportFilters({
  period,
  onPeriodChange,
  onDateRangeChange,
}: ReportFiltersProps) {
  const now = new Date();
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("this-month");
  
  const getDateRange = (period: ReportPeriod): { startDate: Date; endDate: Date } => {
    switch (period) {
      case "current-month":
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
      case "last-3-months":
        return {
          startDate: startOfMonth(subMonths(now, 2)),
          endDate: endOfMonth(now),
        };
      case "last-6-months":
        return {
          startDate: startOfMonth(subMonths(now, 5)),
          endDate: endOfMonth(now),
        };
      case "last-12-months":
        return {
          startDate: startOfMonth(subMonths(now, 11)),
          endDate: endOfMonth(now),
        };
      case "year-to-date":
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
        };
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
    }
  };

  const handleDateRangeChange = (preset: DateRangePreset | "custom", range?: DateRange) => {
    setDateRangePreset(preset);
    if (preset === "custom" && range) {
      setCustomDateRange(range);
      if (onDateRangeChange) {
        onDateRangeChange(new Date(range.startDate), new Date(range.endDate));
      }
    } else if (preset !== "custom") {
      setCustomDateRange(undefined);
      const dateRange = getDateRange(period);
      if (onDateRangeChange) {
        onDateRangeChange(dateRange.startDate, dateRange.endDate);
      }
    }
  };

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    onPeriodChange(newPeriod);
    if (newPeriod !== "custom") {
      setDateRangePreset("this-month");
      setCustomDateRange(undefined);
      const dateRange = getDateRange(newPeriod);
      if (onDateRangeChange) {
        onDateRangeChange(dateRange.startDate, dateRange.endDate);
      }
    } else {
      setDateRangePreset("custom");
    }
  };

  const dateRange = period === "custom" && customDateRange
    ? { startDate: new Date(customDateRange.startDate), endDate: new Date(customDateRange.endDate) }
    : getDateRange(period);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Period:</span>
        {period === "custom" ? (
          <DateRangePicker
            value={dateRangePreset}
            dateRange={customDateRange}
            onValueChange={handleDateRangeChange}
          />
        ) : (
          <Select value={period} onValueChange={(value) => handlePeriodChange(value as ReportPeriod)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
              <SelectItem value="last-12-months">Last 12 Months</SelectItem>
              <SelectItem value="year-to-date">Year to Date</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {format(dateRange.startDate, "MMM dd, yyyy")} - {format(dateRange.endDate, "MMM dd, yyyy")}
      </div>
    </div>
  );
}

