"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Dashboard Layout Component
 * Responsive grid layout for dashboard widgets
 * 
 * Desktop (12-column grid):
 * - Top section: Spare Score (6 col), Net Worth (3 col), Cash Flow (3 col)
 * - Middle section: Left (6 col) for Budgets, Right (6 col) for Goals
 * - Bottom section: Debt (6 col), Investments (6 col)
 * 
 * Mobile: Single column with specific order
 */
export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <div className={cn("w-full space-y-6", className)}>
      {children}
    </div>
  );
}

interface DashboardSectionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Dashboard Section - groups related widgets
 */
export function DashboardSection({ children, className }: DashboardSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
}

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

/**
 * Dashboard Grid - responsive grid for widgets
 * Default: 1 col mobile, 2 col tablet, 3 col desktop
 */
export function DashboardGrid({ 
  children, 
  className,
  cols = { mobile: 1, tablet: 2, desktop: 3 }
}: DashboardGridProps) {
  const desktopCols = cols.desktop || 3;
  const gridColsClass = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    6: "lg:grid-cols-6",
    12: "lg:grid-cols-12",
  }[desktopCols] || "lg:grid-cols-3";

  return (
    <div
      className={cn(
        "grid gap-6",
        // Mobile: 1 column
        "grid-cols-1",
        // Tablet: 2 columns
        "md:grid-cols-2",
        // Desktop: custom columns
        gridColsClass,
        className
      )}
    >
      {children}
    </div>
  );
}

interface DashboardWidgetContainerProps {
  children: ReactNode;
  className?: string;
  colSpan?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

/**
 * Dashboard Widget Container - individual widget wrapper
 * Supports column spanning for larger widgets
 */
export function DashboardWidgetContainer({ 
  children, 
  className,
  colSpan = { mobile: 1, tablet: 1, desktop: 1 }
}: DashboardWidgetContainerProps) {
  const getColSpanClass = (span: number, prefix: string = "") => {
    const prefixClass = prefix ? `${prefix}:` : "";
    const spanMap: Record<number, string> = {
      1: `${prefixClass}col-span-1`,
      2: `${prefixClass}col-span-2`,
      3: `${prefixClass}col-span-3`,
      4: `${prefixClass}col-span-4`,
      5: `${prefixClass}col-span-5`,
      6: `${prefixClass}col-span-6`,
      7: `${prefixClass}col-span-7`,
      8: `${prefixClass}col-span-8`,
      9: `${prefixClass}col-span-9`,
      10: `${prefixClass}col-span-10`,
      11: `${prefixClass}col-span-11`,
      12: `${prefixClass}col-span-12`,
    };
    return spanMap[span] || `${prefixClass}col-span-1`;
  };

  return (
    <div
      className={cn(
        // Mobile
        getColSpanClass(colSpan.mobile || 1),
        // Tablet
        getColSpanClass(colSpan.tablet || 1, "md"),
        // Desktop
        getColSpanClass(colSpan.desktop || 1, "lg"),
        className
      )}
    >
      {children}
    </div>
  );
}
