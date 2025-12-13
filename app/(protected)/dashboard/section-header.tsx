"use client";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 md:gap-2", className)}>
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

