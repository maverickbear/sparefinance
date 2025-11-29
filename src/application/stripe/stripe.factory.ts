/**
 * Stripe Factory
 * Dependency injection factory for StripeService
 */

import { StripeService } from "./stripe.service";

/**
 * Create a StripeService instance with all dependencies
 */
export function makeStripeService(): StripeService {
  return new StripeService();
}

