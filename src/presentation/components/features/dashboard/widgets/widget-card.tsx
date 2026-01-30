"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title: string;
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
  children, 
  className,
  headerAction,
  compact = false 
}: WidgetCardProps) {
  return (
    <Card className={cn("w-full flex flex-col", compact ? "min-h-[280px]" : "min-h-[320px]", className)}>
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-base font-semibold", compact && "text-sm")}>
            {title}
          </CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1 flex flex-col", compact ? "pt-0 space-y-3" : "pt-0 space-y-4")}>
        {children}
      </CardContent>
    </Card>
  );
}
