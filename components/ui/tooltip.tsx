"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProviderProps {
  children: React.ReactNode;
}

const TooltipContext = React.createContext<{ isOpen?: boolean }>({});

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <TooltipContext.Provider value={{}}>{children}</TooltipContext.Provider>;
}

interface TooltipProps {
  children: React.ReactNode;
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: cn("group/tooltip", (children.props as { className?: string }).className),
    } as any);
  }
  return <div className="group/tooltip relative inline-block">{children}</div>;
}

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

export function TooltipContent({ children, className }: TooltipContentProps) {
  return (
    <span
      className={cn(
        "absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded-[12px] opacity-0 group-hover/tooltip:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-md",
        className
      )}
    >
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></span>
    </span>
  );
}

