"use server";

import { revalidateTag } from "next/cache";

/**
 * Server action to revalidate dashboard cache
 * Called by DashboardRealtime when data changes
 */
export async function revalidateDashboard() {
  try {
    // Invalidate all dashboard-related cache tags
    // This will invalidate the cache for dashboard data without affecting the page route
    revalidateTag("dashboard");
    revalidateTag("transactions");
    revalidateTag("budgets");
    revalidateTag("goals");
    revalidateTag("accounts");
    
    return { success: true };
  } catch (error) {
    console.error("Error revalidating dashboard:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

