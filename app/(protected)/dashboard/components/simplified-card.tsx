"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SimplifiedCardProps {
  label: string;
  value: string | ReactNode;
  subtitle?: string;
  pill?: {
    text: string;
    variant?: "default" | "positive" | "warning" | "negative";
  };
  className?: string;
}

export function SimplifiedCard({
  label,
  value,
  subtitle,
  pill,
  className,
}: SimplifiedCardProps) {
  return (
    <div
      className={cn(
        "border border-border rounded-[var(--radius)] p-3.5 bg-transparent min-h-[92px] flex flex-col gap-2",
        className
      )}
    >
      <div className="flex justify-between items-center gap-2.5">
        <span className="text-muted-foreground text-xs">{label}</span>
        {pill && (
          <span
            className={cn(
              "text-xs border border-border rounded-full px-2 py-0.5 whitespace-nowrap text-foreground",
              pill.variant === "positive" && "border-sentiment-positive/30 text-sentiment-positive",
              pill.variant === "warning" && "border-sentiment-warning/30 text-sentiment-warning",
              pill.variant === "negative" && "border-sentiment-negative/30 text-sentiment-negative"
            )}
          >
            {pill.text}
          </span>
        )}
      </div>
      <div className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground">
        {value}
      </div>
      {subtitle && (
        <div className="text-muted-foreground text-xs">{subtitle}</div>
      )}
    </div>
  );
}

