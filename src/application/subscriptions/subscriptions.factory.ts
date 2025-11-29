/**
 * Subscriptions Factory
 * Dependency injection factory for SubscriptionsService
 */

import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionsRepository } from "@/src/infrastructure/database/repositories/subscriptions.repository";

/**
 * Create a SubscriptionsService instance with all dependencies
 */
export function makeSubscriptionsService(): SubscriptionsService {
  const repository = new SubscriptionsRepository();
  return new SubscriptionsService(repository);
}

