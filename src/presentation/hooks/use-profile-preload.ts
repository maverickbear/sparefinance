"use client";

import { useEffect } from "react";

/**
 * Hook to preload profile data in background when app starts
 * This ensures profile data is ready when user navigates to settings
 */
export function useProfilePreload() {
  useEffect(() => {
    // Preload profile data in background when app loads
    // The cache in settings/page.tsx will handle this efficiently
    const preloadProfile = async () => {
      try {
        await fetch("/api/v2/profile");
      } catch (error) {
        // Silently fail - data will load when needed
        console.debug("Profile preload failed:", error);
      }
    };

    // Small delay to not block initial page load
    const timer = setTimeout(preloadProfile, 300);
    return () => clearTimeout(timer);
  }, []);
}

