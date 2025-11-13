"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(80); // Default height in pixels
  
  // Calculate header height dynamically
  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.getElementById('page-header');
      if (header) {
        const height = header.offsetHeight;
        setHeaderHeight(height);
        // Update CSS variable on document root for banner positioning
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    // Initial calculation with multiple delays to ensure DOM is ready
    setTimeout(updateHeaderHeight, 0);
    setTimeout(updateHeaderHeight, 100);
    setTimeout(updateHeaderHeight, 300);

    // Update on resize
    window.addEventListener('resize', updateHeaderHeight);
    
    // Use ResizeObserver for more accurate height tracking
    const header = document.getElementById('page-header');
    if (header) {
      const resizeObserver = new ResizeObserver(() => {
        updateHeaderHeight();
      });
      resizeObserver.observe(header);
      
      return () => {
        window.removeEventListener('resize', updateHeaderHeight);
        resizeObserver.disconnect();
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [title, description, children]);
  
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
      <div 
        id="page-header"
        style={{ 
          '--header-height': `${headerHeight}px`,
        } as React.CSSProperties}
        className={cn(
          "fixed left-0 right-0 z-30 bg-card border-b transition-all duration-300",
          "top-[var(--mobile-header-height,4rem)]",
          "lg:top-0",
          isCollapsed ? "lg:left-16" : "lg:left-64",
          className
        )}
      >
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
    </>
  );
}

