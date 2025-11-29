/**
 * Billing Factory
 * Dependency injection factory for BillingService
 */

import { BillingService } from "./billing.service";

/**
 * Create a BillingService instance with all dependencies
 */
export function makeBillingService(): BillingService {
  return new BillingService();
}

