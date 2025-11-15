"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function ChartCard({ title, description, children, className, headerActions }: ChartCardProps) {
  return (
    <Card className={cn("w-full max-w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base md:text-lg font-semibold">{title}</CardTitle>
            {description && <CardDescription className="text-xs md:text-sm">{description}</CardDescription>}
          </div>
          {headerActions && <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

