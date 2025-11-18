"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const SimpleTabs = TabsPrimitive.Root;

const SimpleTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex items-center gap-3 sm:gap-4 md:gap-6 border-b border-border w-full",
      className
    )}
    {...props}
  />
));
SimpleTabsList.displayName = TabsPrimitive.List.displayName;

const SimpleTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground border-b-2 border-transparent -mb-[1px]",
      "data-[state=active]:text-primary data-[state=active]:border-primary",
      "hover:text-foreground",
      className
    )}
    {...props}
  />
));
SimpleTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const SimpleTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
SimpleTabsContent.displayName = TabsPrimitive.Content.displayName;

export { SimpleTabs, SimpleTabsList, SimpleTabsTrigger, SimpleTabsContent };

