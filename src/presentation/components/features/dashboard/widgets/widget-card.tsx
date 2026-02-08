"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title: string;
  /** Optional subtitle (e.g. "Monthly score") shown below the title */
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  compact?: boolean;
}

/**
 * Base widget card component with consistent styling
 * Ensures uniform height and minimal SaaS design
 */
export function WidgetCard({ 
  title, 
  subtitle,
  children, 
  className,
  headerAction,
  compact = false 
}: WidgetCardProps) {
  return (
    <Card className={cn("w-full flex flex-col", compact ? "min-h-[280px]" : "min-h-[320px]", className)}>
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={cn("text-base font-semibold", compact && "text-sm")}>
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1 flex flex-col", compact ? "pt-0 space-y-3" : "pt-0 space-y-4")}>
        {children}
      </CardContent>
    </Card>
  );
}
