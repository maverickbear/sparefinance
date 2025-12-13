"use client";

import { useEffect } from "react";

/**
 * Hook to manage fixed layout classes on body/html
 * Only applies to protected pages (not public pages, API routes, or welcome)
 */
export function useLayoutFixed(shouldUseFixedLayout: boolean) {
  useEffect(() => {
    if (shouldUseFixedLayout) {
      document.body.classList.add("layout-fixed");
      document.documentElement.classList.add("layout-fixed");
      return () => {
        document.body.classList.remove("layout-fixed");
        document.documentElement.classList.remove("layout-fixed");
      };
    } else {
      // Ensure classes are removed if we're not using fixed layout
      document.body.classList.remove("layout-fixed");
      document.documentElement.classList.remove("layout-fixed");
    }
  }, [shouldUseFixedLayout]);
}

