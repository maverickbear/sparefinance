"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BillingInterval = "month" | "year";

interface BillingIntervalToggleProps {
  value: BillingInterval;
  onValueChange: (value: BillingInterval) => void;
  /** Percentage shown on Yearly option (e.g. 17). Set to 0 or omit to hide. */
  savePercent?: number;
  /** Label above the toggle (e.g. "Billing"). */
  label?: string;
  /** Custom labels for the options. */
  monthlyLabel?: string;
  yearlyLabel?: string;
  className?: string;
}

/**
 * Reusable toggle for choosing between Monthly and Yearly billing.
 * Uses rounded (pill) corners for the container and selected segment.
 */
export function BillingIntervalToggle({
  value,
  onValueChange,
  savePercent = 0,
  label = "Billing",
  monthlyLabel = "Monthly",
  yearlyLabel = "Yearly",
  className,
}: BillingIntervalToggleProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-1.5">
        <button
          type="button"
          onClick={() => onValueChange("month")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            value === "month"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {monthlyLabel}
        </button>
        <button
          type="button"
          onClick={() => onValueChange("year")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            value === "year"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {yearlyLabel}
          {savePercent > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "text-xs px-2 py-0.5 shrink-0 rounded-full border-0 font-medium",
                value === "year"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary/10 text-primary"
              )}
            >
              Save {savePercent}%
            </Badge>
          )}
        </button>
      </div>
    </div>
  );
}
