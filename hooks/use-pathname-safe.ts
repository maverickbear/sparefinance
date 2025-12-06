"use client";

import { useState, useEffect } from "react";

/**
 * Hook to safely get pathname, returning null during SSR/prerender
 * This prevents "uncached data accessed" errors during build time
 * 
 * Uses window.location instead of usePathname() to avoid build-time errors.
 * This works because window.location is only accessed after client-side mount.
 * 
 * Note: This hook will not detect Next.js router changes automatically.
 * For components that need real-time router updates, consider using usePathname()
 * directly and handling the build-time error at the component level.
 * 
 * Usage:
 *   const pathname = usePathnameSafe();
 *   if (!pathname) {
 *     // Handle SSR/prerender case
 *     return <div>Loading...</div>;
 *   }
 */
export function usePathnameSafe() {
  const [pathname, setPathname] = useState<string | null>(null);
  
  useEffect(() => {
    // Only access pathname on client side after mount
    // This prevents accessing uncached data during build
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
      
      // Listen for browser navigation (back/forward)
      const handlePopState = () => {
        setPathname(window.location.pathname);
      };
      
      window.addEventListener('popstate', handlePopState);
      
      // Also try to detect Next.js router changes
      // Next.js router uses pushState/replaceState, so we intercept those
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      const updatePathname = () => {
        setPathname(window.location.pathname);
      };
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        // Use setTimeout to ensure pathname is updated after Next.js router
        setTimeout(updatePathname, 0);
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(updatePathname, 0);
      };
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    }
  }, []);
  
  // During SSR/prerender (before client-side mount), return null
  // This prevents accessing uncached data during build
  return pathname;
}

