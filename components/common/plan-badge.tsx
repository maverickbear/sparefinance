"use client";

import { Badge } from "@/components/ui/badge";

interface PlanBadgeProps {
  plan: string; // Simplified: only "pro" exists, but allow string for flexibility
  className?: string;
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  // Only Pro plan exists now
  const label = plan === "pro" ? "Pro" : plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <Badge variant="default" className={className}>
      {label}
    </Badge>
  );
}

