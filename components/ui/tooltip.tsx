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
  return <div className="relative group/tooltip">{children}</div>;
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
  side?: "top" | "bottom" | "left" | "right";
}

export function TooltipContent({ children, className, side = "bottom" }: TooltipContentProps) {
  const sideClasses = {
    top: "left-1/2 -translate-x-1/2 bottom-full mb-2",
    bottom: "left-1/2 -translate-x-1/2 top-full mt-2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const arrowClasses = {
    top: "absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-primary",
    bottom: "absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-primary",
    left: "absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-primary",
    right: "absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-primary",
  };

  return (
    <span
      className={cn(
        "absolute px-2 py-1 text-xs bg-primary text-primary-foreground rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-[60] shadow-md",
        sideClasses[side],
        className
      )}
    >
      {children}
    </span>
  );
}

