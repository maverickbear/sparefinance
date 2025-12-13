/**
 * Health Check Service
 * Provides health and readiness checks for the application
 */

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    database?: {
      status: 'ok' | 'error';
      message?: string;
    };
    stripe?: {
      status: 'ok' | 'error' | 'not_configured';
      message?: string;
    };
  };
  timestamp: string;
}

export class HealthCheckService {
  /**
   * Perform liveness check
   * Returns true if the application is running
   */
  async checkLiveness(): Promise<boolean> {
    // Liveness check is simple - just verify the application is running
    return true;
  }

  /**
   * Perform readiness check
   * Verifies that all critical dependencies are available
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

    // Check database connection
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.from('users').select('id').limit(1);
      
      if (error) {
        checks.database = {
          status: 'error',
          message: error.message,
        };
        overallStatus = 'unhealthy';
      } else {
        checks.database = {
          status: 'ok',
        };
      }
    } catch (error) {
      logger.error("[HealthCheckService] Database check failed:", error);
      checks.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      overallStatus = 'unhealthy';
    }

    // Check Stripe configuration (optional - not critical for basic operation)
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        // Simple check - just verify the key is set
        checks.stripe = {
          status: 'ok',
        };
      } catch (error) {
        logger.warn("[HealthCheckService] Stripe check failed:", error);
        checks.stripe = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        // Stripe is not critical for basic operation, so we don't mark as unhealthy
      }
    } else {
      checks.stripe = {
        status: 'not_configured',
      };
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

