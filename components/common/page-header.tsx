"use client";

import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Listen to sidebar state changes from localStorage and events
  useEffect(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }

    // Listen for sidebar toggle events
    const handleSidebarToggle = (event: CustomEvent<{ isCollapsed: boolean }>) => {
      setIsCollapsed(event.detail.isCollapsed);
    };

    window.addEventListener("sidebar-toggle", handleSidebarToggle as EventListener);

    // Also listen to localStorage changes (in case of multiple tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        setIsCollapsed(e.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);
  
  return (
    <>
      <div className={cn(
        "fixed top-16 lg:top-0 left-0 right-0 z-30 bg-card border-b transition-all duration-300",
        isCollapsed ? "lg:left-16" : "lg:left-64",
        className
      )}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4 md:py-6">
            <div className="space-y-1">
              <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
              {description && (
                <p className="text-sm md:text-base text-muted-foreground">{description}</p>
              )}
            </div>
            {children && (
              <div className="flex gap-2">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-[calc(4rem+1px+4rem)] lg:h-[calc(5rem+1px)] md:h-[calc(5rem+1px+4rem)]" />
    </>
  );
}

