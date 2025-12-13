"use client";

import { useState, useEffect } from "react";

/**
 * Hook to manage sidebar collapsed state
 * Syncs with localStorage and dispatches events for other components
 */
export function useSidebarState() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load initial state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsSidebarCollapsed(saved === "true");
    }
  }, []);

  // Save collapsed state to localStorage and dispatch event
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isSidebarCollapsed));
    // Dispatch event for layout-wrapper to listen
    window.dispatchEvent(
      new CustomEvent("sidebar-toggle", { detail: { isCollapsed: isSidebarCollapsed } })
    );
  }, [isSidebarCollapsed]);

  // Listen for sidebar toggle events from other components (e.g., Nav)
  useEffect(() => {
    const handleSidebarToggle = (event: CustomEvent<{ isCollapsed: boolean }>) => {
      setIsSidebarCollapsed(event.detail.isCollapsed);
    };

    window.addEventListener("sidebar-toggle", handleSidebarToggle as EventListener);

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
    };
  }, []);

  return { isSidebarCollapsed, setIsSidebarCollapsed };
}

