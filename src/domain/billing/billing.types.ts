/**
 * Domain types for billing
 * Pure TypeScript types with no external dependencies
 */

export interface BaseBillingData {
  subscription: any | null; // BaseSubscription from subscriptions domain
  plan: any | null; // BasePlan from subscriptions domain
  limits: any | null; // BasePlanFeatures from subscriptions domain
  transactionLimit: BaseLimitCheckResult | null;
  accountLimit: BaseLimitCheckResult | null;
  interval: "month" | "year" | null;
}

export interface BaseLimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

