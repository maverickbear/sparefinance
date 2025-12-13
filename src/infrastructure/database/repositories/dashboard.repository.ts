/**
 * Dashboard Repository
 * Data access layer for dashboard operations - only handles database operations
 * 
 * SIMPLIFIED: Uses simple timestamp-based update checking instead of complex hash/RPC
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export class DashboardRepository {
  /**
   * Get the maximum updated_at timestamp from relevant tables
   * Simplified approach: queries transactions table (most frequently updated)
   * This is sufficient for detecting changes in dashboard data
   */
  async getMaxUpdatedAt(): Promise<number | null> {
    const supabase = await createServerClient();
    
    try {
      // Query transactions table (most frequently updated table)
      // This is sufficient for detecting changes in dashboard data
      const { data, error } = await supabase
        .from("transactions")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        logger.warn("[DashboardRepository] Error getting max updated_at:", error);
        return Date.now(); // Safe default
      }
      
      if (!data?.updated_at) {
        return Date.now(); // Default to now if no data
      }
      
      return new Date(data.updated_at).getTime();
    } catch (err) {
      logger.warn("[DashboardRepository] Error getting max updated_at:", err);
      return Date.now(); // Safe default
    }
  }
}

