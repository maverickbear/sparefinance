"use client";

import { useDashboardUpdates } from "@/hooks/use-dashboard-updates";
import { usePathname } from "next/navigation";

/**
 * Component that silently checks for dashboard updates
 * This component doesn't render anything visible to the user
 */
export function DashboardUpdateChecker() {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  
  // Only enable checking when on dashboard page
  useDashboardUpdates(isDashboard);

  // This component doesn't render anything
  return null;
}

