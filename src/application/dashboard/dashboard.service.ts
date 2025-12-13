/**
 * Dashboard Service
 * Provides dashboard-related business logic
 */

import { SubscriptionsRepository } from "@/src/infrastructure/database/repositories/subscriptions.repository";
import { DashboardRepository } from "@/src/infrastructure/database/repositories/dashboard.repository";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { logger } from "@/src/infrastructure/utils/logger";
import { UpdateCheckResult } from "@/src/domain/dashboard/dashboard.types";

export interface TransactionUsage {
  current: number;
  limit: number;
  percentage: number;
  warning: boolean;
  remaining: number;
  isUnlimited: boolean;
}

export class DashboardService {
  constructor(
    private subscriptionsRepository: SubscriptionsRepository = new SubscriptionsRepository(),
    private dashboardRepository: DashboardRepository = new DashboardRepository()
  ) {}

  /**
   * Get transaction usage for current month
   */
  async getTransactionUsage(userId: string, month?: Date): Promise<TransactionUsage> {
    try {
      const { limits } = await getCachedSubscriptionData(userId);
      const checkMonth = month || new Date();
      const monthDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), 1);

      const current = await this.subscriptionsRepository.getUserMonthlyUsage(userId, monthDate);

      // Unlimited transactions
      if (limits.maxTransactions === -1) {
        return {
          current,
          limit: -1,
          percentage: 0,
          warning: false,
          remaining: -1,
          isUnlimited: true,
        };
      }

      const percentage = Math.round((current / limits.maxTransactions) * 100);
      const warning = percentage >= 80; // Warn when 80% or more
      const remaining = Math.max(0, limits.maxTransactions - current);

      return {
        current,
        limit: limits.maxTransactions,
        percentage,
        warning,
        remaining,
        isUnlimited: false,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting transaction usage:", error);
      throw error;
    }
  }

  /**
   * Check for dashboard updates since lastCheck timestamp
   * 
   * SIMPLIFIED: Uses simple timestamp-based checking instead of complex hash/RPC
   * Queries transactions table (most frequently updated) to detect changes
   */
  async checkUpdates(userId: string, lastCheck?: string): Promise<UpdateCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple query: get MAX(updated_at) from transactions table
      // This is sufficient for detecting changes in dashboard data
      const maxUpdate = await this.dashboardRepository.getMaxUpdatedAt();
      const timestamp = maxUpdate ? new Date(maxUpdate).toISOString() : null;

      // Check if there are updates since lastCheck
      let hasUpdates = false;
      if (lastCheck) {
        const lastCheckTime = new Date(lastCheck).getTime();
        hasUpdates = maxUpdate ? maxUpdate > lastCheckTime : true;
      } else {
        // If no lastCheck provided, assume there are updates (first check)
        hasUpdates = true;
      }

      const executionTime = Date.now() - startTime;

      return {
        hasUpdates,
        // Keep currentHash for frontend compatibility (use timestamp as hash)
        currentHash: timestamp || new Date().toISOString(),
        timestamp,
        source: "database",
        executionTime,
      };
    } catch (error) {
      logger.error("[DashboardService] Error checking updates:", error);
      throw error;
    }
  }
}
