/**
 * Performance measurement utilities
 * Used to track page load times and performance metrics
 */

import { logger } from "./logger";

/**
 * Measure performance for server-side pages using Date (for Node.js)
 * Usage:
 *   // IMPORTANT: In Next.js 15, call this AFTER accessing uncached data
 *   // (e.g., after await fetch(), cookies(), headers(), etc.)
 *   const perf = startServerPagePerformance("Dashboard");
 *   // ... page logic ...
 *   perf.end();
 * 
 * NOTE: In Next.js 15, Date.now() must be called after accessing uncached data
 * to ensure proper dynamic rendering. Always call this function AFTER fetching
 * data or accessing cookies/headers/searchParams.
 */
export function startServerPagePerformance(pageName: string) {
  const startTime = Date.now();
  // Logging removed for cleaner console

  return {
    end: () => {
      // Performance tracking disabled
    },
    log: (message: string) => {
      // Performance tracking disabled
    },
  };
}

