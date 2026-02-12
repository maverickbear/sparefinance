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
  const [isMounted, setIsMounted] = useState(false);
  
  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Calculate header height dynamically
  useEffect(() => {
    if (!isMounted) return;
    
    const updateHeaderHeight = () => {
      const header = document.getElementById('page-header');
      if (header) {
        // Force height to 64px
        header.style.height = '64px';
        const height = 64; // Always 64px
        setHeaderHeight(height);
        // Update CSS variable on document root for banner positioning
        document.documentElement.style.setProperty('--header-height', '64px');
        document.documentElement.style.setProperty('--page-header-height', '64px');
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
  }, [title, description, children, isMounted]);
  
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
        style={isMounted ? { 
          '--header-height': '64px',
          height: '64px',
          lineHeight: '64px',
        } as React.CSSProperties : { height: '64px', lineHeight: '64px' }}
        className={cn(
          "z-30 bg-card border-b border-border transition-all duration-300",
          "hidden lg:block",
          "box-border overflow-hidden",
          className
        )}
        suppressHydrationWarning
      >
        <div className="w-full p-4 lg:p-8 h-full flex items-center">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 w-full">
            <div className="flex flex-col gap-1">
              {/* Title uses content.primary (text-foreground) to emphasise primary content */}
              <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
              {/* Description uses content.secondary (text-muted-foreground) for body text */}
              {description && (
                <p className="text-sm md:text-base text-muted-foreground">{description}</p>
              )}
            </div>
            {children && (
              <div className="flex gap-3 flex-wrap">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

