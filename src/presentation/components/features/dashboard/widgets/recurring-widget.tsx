"use client";

import { RecurringWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import { differenceInCalendarDays, isToday, isTomorrow, parse } from "date-fns";

interface RecurringWidgetProps {
  data: RecurringWidgetData | null;
  className?: string;
}

export function RecurringWidget({ data, className }: RecurringWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href="/planned-payment" 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Planned Payments"
      headerAction={<SeeAllLink />} 
      className={className}
    >
      <div className="space-y-4">
        {data.items.map((item) => (
          <Link
            key={item.id}
            href="/planned-payment"
            className="flex items-center justify-between rounded-lg transition-colors hover:bg-muted/50 -mx-2 px-2 py-1"
          >
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <TransactionTypeIcon type={item.type} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {item.type === "income" ? "Income" : item.type === "expense" ? "Expense" : "Transfer"}
                </TooltipContent>
              </Tooltip>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.name}</span>
                <span className="text-xs text-slate-400">{formatFriendlyDueDate(item.nextDate)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <span className="text-sm font-semibold text-black dark:text-foreground">
                 {formatMoney(item.amount)}
               </span>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

/**
 * Parse date string that may be YYYY-MM-DD or "d MMM" / "dd MMM" (e.g. "25 Feb", "28 Feb").
 * Returns a Date at noon to avoid timezone issues, or null if unparseable.
 */
function parseDueDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  // YYYY-MM-DD (from API)
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const due = new Date(s.slice(0, 10) + "T12:00:00");
    return isNaN(due.getTime()) ? null : due;
  }
  // "d MMM" or "dd MMM" (e.g. "25 Feb", "28 Feb" – from cache or old API)
  const year = new Date().getFullYear();
  try {
    const due = parse(s + " " + year, "d MMM yyyy", new Date());
    due.setHours(12, 0, 0, 0);
    return isNaN(due.getTime()) ? null : due;
  } catch {
    return null;
  }
}

/**
 * Format a date string (YYYY-MM-DD or "dd MMM") as user-friendly relative text.
 */
function formatFriendlyDueDate(dateStr: string): string {
  const due = parseDueDate(dateStr);
  if (!due) return dateStr;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  due.setHours(12, 0, 0, 0);
  const days = differenceInCalendarDays(due, today);
  if (days < 0) return "Overdue";
  if (isToday(due)) return "Today";
  if (isTomorrow(due)) return "Tomorrow";
  if (days >= 2 && days <= 6) return `In ${days} days`;
  if (days >= 7 && days <= 13) return "Next week";
  if (days >= 14 && days <= 20) return "In 2 weeks";
  if (days >= 21 && days <= 27) return "In 3 weeks";
  if (days >= 28 && days <= 60) return "In 1 month";
  // Fallback: "28 Feb"
  const d = due.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[due.getMonth()]}`;
}

function TransactionTypeIcon({ type }: { type: "income" | "expense" | "transfer" }) {
  if (type === "income") return <ArrowUp className="h-5 w-5 text-emerald-500" />;
  if (type === "expense") return <ArrowDown className="h-5 w-5 text-red-500" />;
  return <ArrowLeftRight className="h-5 w-5 text-slate-500" />; // transfer
}
