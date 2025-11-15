"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, startOfMonth, addMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MonthSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Get selected month from URL or use current month
  const monthParam = searchParams.get("month");
  const selectedMonth = monthParam 
    ? (() => {
        // Parse YYYY-MM-DD format and create date in local timezone (same as dashboard)
        const [year, month, day] = monthParam.split('-').map(Number);
        return startOfMonth(new Date(year, month - 1, day));
      })()
    : startOfMonth(new Date());
  
  const currentMonth = startOfMonth(new Date());
  
  // Generate list of months (12 months back, then 12 months forward)
  // Order: past months (most recent first), then future months
  const months: Date[] = [];
  // Add past months (1 to 12 months back, most recent first)
  for (let i = 1; i <= 12; i++) {
    months.push(addMonths(currentMonth, -i));
  }
  // Reverse to show most recent past month first
  months.reverse();
  // Add future months (1 to 12 months ahead)
  for (let i = 1; i <= 12; i++) {
    months.push(addMonths(currentMonth, i));
  }
  
  const handleMonthChange = (value: string) => {
    if (value === "current") {
      // Go to current month
      const params = new URLSearchParams(searchParams.toString());
      params.delete("month");
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    } else {
      // Parse the value (format: YYYY-MM-DD)
      const [year, month, day] = value.split('-').map(Number);
      const newMonth = startOfMonth(new Date(year, month - 1, day));
      const monthString = format(newMonth, "yyyy-MM-dd");
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", monthString);
      router.push(`${pathname}?${params.toString()}`);
    }
  };
  
  // Get the value for the select (format: YYYY-MM-DD)
  const selectedValue = format(selectedMonth, "yyyy-MM-dd");
  const isCurrentMonth = selectedMonth.getTime() === currentMonth.getTime();
  
  return (
    <Select
      value={isCurrentMonth ? "current" : selectedValue}
      onValueChange={handleMonthChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          {format(selectedMonth, "MMMM yyyy")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="current">
          {format(currentMonth, "MMMM yyyy")} (Current)
        </SelectItem>
        {months.map((month) => {
          const monthValue = format(month, "yyyy-MM-dd");
          const monthLabel = format(month, "MMMM yyyy");
          const isCurrent = month.getTime() === currentMonth.getTime();
          
          // Skip if it's the current month (already shown above)
          if (isCurrent) return null;
          
          return (
            <SelectItem key={monthValue} value={monthValue}>
              {monthLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

