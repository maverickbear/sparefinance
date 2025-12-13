/**
 * Subscription Detection Factory
 * 
 * @deprecated SubscriptionDetectionService has been integrated into TransactionsService.
 * Use makeTransactionsService().detectSubscriptions() instead.
 * This factory is kept for backward compatibility but will be removed in a future version.
 */

import { SubscriptionDetectionService } from "./subscription-detection.service";

/**
 * Create a SubscriptionDetectionService instance with all dependencies
 * @deprecated Use makeTransactionsService().detectSubscriptions() instead
 */
export function makeSubscriptionDetectionService(): SubscriptionDetectionService {
  return new SubscriptionDetectionService();
}

