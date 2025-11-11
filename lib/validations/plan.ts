import { z } from "zod";

export const planFeaturesSchema = z.object({
  maxTransactions: z.number(), // -1 for unlimited
  maxAccounts: z.number(), // -1 for unlimited
  hasInvestments: z.boolean(),
  hasAdvancedReports: z.boolean(),
  hasCsvExport: z.boolean(),
  hasDebts: z.boolean(),
  hasGoals: z.boolean(),
  hasBankIntegration: z.boolean(),
});

export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

export const planSchema = z.object({
  id: z.string(),
  name: z.enum(["free", "basic", "premium"]),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  features: planFeaturesSchema,
  stripePriceIdMonthly: z.string().nullable().optional(),
  stripePriceIdYearly: z.string().nullable().optional(),
  stripeProductId: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Plan = z.infer<typeof planSchema>;

export const subscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string(),
  status: z.enum(["active", "cancelled", "past_due", "trialing"]),
  stripeSubscriptionId: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  currentPeriodStart: z.date().nullable().optional(),
  currentPeriodEnd: z.date().nullable().optional(),
  trialStartDate: z.date().nullable().optional(),
  trialEndDate: z.date().nullable().optional(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

