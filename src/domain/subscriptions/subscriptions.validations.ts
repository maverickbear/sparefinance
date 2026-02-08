/**
 * Domain validations for subscriptions
 * Zod schemas for subscription-related data validation
 */

import { z } from "zod";

/**
 * Plan Features Schema
 * Defines all available plan features and their types
 */
export const planFeaturesSchema = z.object({
  maxTransactions: z.number(), // -1 for unlimited
  maxAccounts: z.number(), // -1 for unlimited
  hasInvestments: z.boolean(),
  hasAdvancedReports: z.boolean(),
  hasCsvExport: z.boolean(),
  hasCsvImport: z.boolean(),
  hasDebts: z.boolean(),
  hasGoals: z.boolean(),
  hasBankIntegration: z.boolean(),
  hasHousehold: z.boolean(),
  hasBudgets: z.boolean(),
  hasReceiptScanner: z.boolean(),
});

/**
 * Plan Features Type
 * Inferred from planFeaturesSchema
 */
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

/**
 * Plan Schema
 * Defines the structure of a subscription plan
 */
export const planSchema = z.object({
  id: z.string(),
  name: z.string(), // Simplified: only "pro" plan exists, but allow string for flexibility
  priceMonthly: z.number(),
  priceYearly: z.number(),
  features: planFeaturesSchema,
  stripePriceIdMonthly: z.string().nullable().optional(),
  stripePriceIdYearly: z.string().nullable().optional(),
  stripeProductId: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

/**
 * Plan Type
 * Inferred from planSchema
 */
export type Plan = z.infer<typeof planSchema>;

/**
 * Subscription Schema
 * Defines the structure of a subscription
 */
export const subscriptionSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  householdId: z.string().nullable(),
  planId: z.string(),
  status: z.enum(["active", "trialing", "cancelled", "past_due", "unpaid"]),
  stripeSubscriptionId: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  currentPeriodStart: z.date().or(z.string()).nullable(),
  currentPeriodEnd: z.date().or(z.string()).nullable(),
  trialEndDate: z.date().or(z.string()).nullable(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

/**
 * Subscription Type
 * Inferred from subscriptionSchema
 */
export type Subscription = z.infer<typeof subscriptionSchema>;

/**
 * User Service Subscription Form Schema
 * Defines the structure for creating/updating user service subscriptions
 */
export const userServiceSubscriptionFormSchema = z.object({
  serviceName: z.string().min(1, "Service name is required"),
  subcategoryId: z.string().optional().nullable(),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional().nullable(),
  billingFrequency: z.enum(["monthly", "yearly", "weekly", "biweekly", "semimonthly", "daily"]),
  billingDay: z.number().int().min(1).max(31).optional().nullable(),
  accountId: z.string().min(1, "Account ID is required"),
  firstBillingDate: z.union([z.date(), z.string()]),
  categoryId: z.string().optional().nullable(),
  newSubcategoryName: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
});

/**
 * User Service Subscription Form Type
 * Inferred from userServiceSubscriptionFormSchema
 */
export type UserServiceSubscriptionFormData = z.infer<typeof userServiceSubscriptionFormSchema>;

