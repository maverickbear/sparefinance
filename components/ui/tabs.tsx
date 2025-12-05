"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    suppressHydrationWarning
    className={cn(
      // Base styles using design tokens
      "inline-flex items-center justify-center",
      // Background using design tokens
      "bg-muted text-muted-foreground",
      // Border radius using design token
      "rounded-[var(--radius)]",
      // Padding using design tokens - responsive
      "p-1",
      // Height - responsive for mobile touch targets (min 44px) and desktop
      "h-11 md:h-10",
      // Smooth transitions
      "transition-colors duration-200",
      // Focus styles for accessibility
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    suppressHydrationWarning
    className={cn(
      // Base layout
      "inline-flex items-center justify-center",
      "whitespace-nowrap",
      // Border radius using design token
      "rounded-[calc(var(--radius)-2px)]",
      // Padding - responsive for better mobile touch targets
      "px-3 py-2 md:px-3 md:py-1.5",
      // Typography - responsive font sizes
      "text-sm font-medium",
      // Minimum touch target size for mobile (44px)
      "min-h-[44px] md:min-h-0",
      // Transitions for smooth state changes
      "transition-all duration-200 ease-in-out",
      // Ring offset for focus
      "ring-offset-background",
      // Focus styles for accessibility
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Disabled state
      "disabled:pointer-events-none disabled:opacity-50",
      // Active state using design tokens
      "data-[state=active]:bg-background",
      "data-[state=active]:text-foreground",
      "data-[state=active]:shadow-sm",
      // Hover state for better UX
      "hover:text-foreground/80",
      "data-[state=active]:hover:text-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    suppressHydrationWarning
    className={cn(
      // Spacing
      "mt-2",
      // Ring offset for focus
      "ring-offset-background",
      // Focus styles for accessibility
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Animation for content appearance
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

