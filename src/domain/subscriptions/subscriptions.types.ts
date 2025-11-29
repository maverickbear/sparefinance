/**
 * Domain types for subscriptions
 * Pure TypeScript types with no external dependencies
 */

export interface BaseSubscription {
  id: string;
  userId: string | null;
  householdId: string | null;
  planId: string;
  status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: Date | string | null;
  currentPeriodEnd: Date | string | null;
  trialEndDate: Date | string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BasePlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: BasePlanFeatures;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BasePlanFeatures {
  maxTransactions: number;
  maxAccounts: number;
  hasInvestments: boolean;
  hasAdvancedReports: boolean;
  hasCsvExport: boolean;
  hasCsvImport: boolean;
  hasDebts: boolean;
  hasGoals: boolean;
  hasBankIntegration: boolean;
  hasHousehold: boolean;
  hasBudgets: boolean;
  hasReceiptScanner: boolean;
}

export interface BaseSubscriptionData {
  subscription: BaseSubscription | null;
  plan: BasePlan | null;
  limits: BasePlanFeatures;
}

export interface BaseLimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

// User Service Subscription types (for subscription services like Netflix, Spotify, etc.)
export interface UserServiceSubscription {
  id: string;
  userId: string;
  serviceName: string;
  subcategoryId?: string | null;
  planId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  isActive: boolean;
  firstBillingDate: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  subcategory?: { id: string; name: string; logo?: string | null } | null;
  account?: { id: string; name: string } | null;
  serviceLogo?: string | null; // Logo from SubscriptionService table
  plan?: { id: string; planName: string } | null; // Plan from SubscriptionServicePlan
}

export interface UserServiceSubscriptionFormData {
  serviceName: string;
  subcategoryId?: string | null;
  amount: number;
  description?: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay?: number | null;
  accountId: string;
  firstBillingDate: Date | string;
  categoryId?: string | null;
  newSubcategoryName?: string | null;
  planId?: string | null; // ID of the selected SubscriptionServicePlan
}

