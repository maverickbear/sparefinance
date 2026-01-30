"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface WidgetEmptyStateProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  icon?: LucideIcon;
}

export function WidgetEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon: Icon,
}: WidgetEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      {Icon && (
        <div className="mx-auto w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm">{description}</p>
      <div className="flex flex-col gap-2 w-full">
        {primaryAction && (
          <Button asChild size="small" variant="outline" className="w-full">
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" asChild size="small" className="w-full">
            <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
