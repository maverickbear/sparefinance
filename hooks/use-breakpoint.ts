import { useEffect, useState, useRef } from "react";

type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | null;

/**
 * Custom hook to detect current Tailwind breakpoint
 * Logs breakpoint changes in development mode
 * 
 * Breakpoints:
 * - xs: 475px
 * - sm: 640px
 * - md: 768px
 * - lg: 1024px
 * - xl: 1280px
 * - 2xl: 1536px
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(null);
  const previousBreakpointRef = useRef<Breakpoint>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Define breakpoints matching tailwind.config.ts
    const breakpoints = {
      xs: "(min-width: 475px)",
      sm: "(min-width: 640px)",
      md: "(min-width: 768px)",
      lg: "(min-width: 1024px)",
      xl: "(min-width: 1280px)",
      "2xl": "(min-width: 1536px)",
    } as const;

    // Create media query listeners
    const mediaQueries = Object.entries(breakpoints).map(([name, query]) => {
      const mq = window.matchMedia(query);
      return { name: name as Breakpoint, mq };
    });

    // Function to determine current breakpoint
    const getCurrentBreakpoint = (): Breakpoint => {
      // Check from largest to smallest
      // The first matching breakpoint (from largest) is the current one
      for (let i = mediaQueries.length - 1; i >= 0; i--) {
        if (mediaQueries[i].mq.matches) {
          return mediaQueries[i].name;
        }
      }
      // If no breakpoint matches, screen is smaller than xs (475px)
      return null;
    };

    // Set initial breakpoint
    const current = getCurrentBreakpoint();
    setBreakpoint(current);
    previousBreakpointRef.current = current;

    // Handler for breakpoint changes
    const handleChange = () => {
      const newBreakpoint = getCurrentBreakpoint();
      const previous = previousBreakpointRef.current;
      
      if (newBreakpoint !== previous) {
        setBreakpoint(newBreakpoint);
        previousBreakpointRef.current = newBreakpoint;
      }
    };

    // Add listeners
    mediaQueries.forEach(({ mq }) => {
      // Modern browsers
      if (mq.addEventListener) {
        mq.addEventListener("change", handleChange);
      } else {
        // Fallback for older browsers
        mq.addListener(handleChange);
      }
    });

    // Cleanup
    return () => {
      mediaQueries.forEach(({ mq }) => {
        if (mq.removeEventListener) {
          mq.removeEventListener("change", handleChange);
        } else {
          mq.removeListener(handleChange);
        }
      });
    };
  }, []);

  return breakpoint;
}

