/**
 * Onboarding Domain Validations
 * Zod schemas for onboarding feature
 */

import { z } from "zod";
import { ExpectedIncomeRange } from "./onboarding.types";

export const expectedIncomeRangeSchema = z.enum([
  "0-50k",
  "50k-100k",
  "100k-150k",
  "150k-250k",
  "250k+",
]).nullable();

export const expectedIncomeAmountSchema = z.number().positive("Expected income amount must be positive").nullable().optional();

export type ExpectedIncomeRangeFormData = z.infer<typeof expectedIncomeRangeSchema>;

export interface ExpectedIncomeFormData {
  incomeRange: ExpectedIncomeRange;
  incomeAmount?: number | null; // Optional custom amount
}

// Simplified onboarding validations
export const userGoalSchema = z.enum([
  "track-spending",
  "save-money",
  "pay-debt",
  "plan-budget",
  "invest-wealth",
  "household-finance",
]);

export const householdTypeSchema = z.enum(["personal", "shared"]);

export const simplifiedOnboardingSchema = z.object({
  goals: z.array(userGoalSchema).min(1, "Please select at least one goal"),
  householdType: householdTypeSchema,
  incomeRange: expectedIncomeRangeSchema.optional().nullable(),
  incomeAmount: expectedIncomeAmountSchema,
  location: z.object({
    country: z.string(),
    stateOrProvince: z.string().nullable(),
  }).nullable().optional(),
});

export type SimplifiedOnboardingFormData = z.infer<typeof simplifiedOnboardingSchema>;

