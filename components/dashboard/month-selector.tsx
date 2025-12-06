"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DateRange = "this-month" | "last-month" | "last-60-days" | "last-90-days";

export function MonthSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Get selected range from URL or default to "this-month"
  const rangeParam = searchParams.get("range") as DateRange | null;
  const selectedRange: DateRange = rangeParam && ["this-month", "last-month", "last-60-days", "last-90-days"].includes(rangeParam)
    ? rangeParam
    : "this-month";
  
  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "this-month") {
      // Remove range param to default to this month
      params.delete("range");
      params.delete("month"); // Also remove old month param if present
    } else {
      params.set("range", value);
      params.delete("month"); // Remove old month param
    }
    
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };
  
  const getDisplayText = (range: DateRange): string => {
    switch (range) {
      case "this-month":
        return "This Month";
      case "last-month":
        return "Last Month";
      case "last-60-days":
        return "Last 60 Days";
      case "last-90-days":
        return "Last 90 Days";
      default:
        return "This Month";
    }
  };
  
  return (
    <Select
      value={selectedRange}
      onValueChange={handleRangeChange}
    >
      <SelectTrigger size="small" className="w-[140px]">
        <SelectValue>
          {getDisplayText(selectedRange)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="this-month">This Month</SelectItem>
        <SelectItem value="last-month">Last Month</SelectItem>
        <SelectItem value="last-60-days">Last 60 Days</SelectItem>
        <SelectItem value="last-90-days">Last 90 Days</SelectItem>
      </SelectContent>
    </Select>
  );
}

