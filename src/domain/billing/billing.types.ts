/**
 * Domain types for billing
 * Pure TypeScript types with no external dependencies
 */

import type {
  BaseSubscription,
  BasePlan,
  BasePlanFeatures,
} from "@/src/domain/subscriptions/subscriptions.types";

export interface BaseBillingData {
  subscription: BaseSubscription | null;
  plan: BasePlan | null;
  limits: BasePlanFeatures | null;
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

