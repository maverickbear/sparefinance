/**
 * Onboarding Domain Types
 * Pure domain types for onboarding feature
 */

import { BudgetRuleType } from "../budgets/budget-rules.types";

export type ExpectedIncomeRange = "0-50k" | "50k-100k" | "100k-150k" | "150k-250k" | "250k+" | null;

// User goals for simplified onboarding
export type UserGoal = 
  | "track-spending" 
  | "save-money" 
  | "pay-debt" 
  | "plan-budget" 
  | "invest-wealth" 
  | "household-finance";

// Household type for simplified onboarding
export type HouseholdType = "personal" | "shared";

export interface OnboardingStatusExtended {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  hasPersonalData: boolean; // phone and dateOfBirth
  hasExpectedIncome: boolean;
  hasPlan: boolean; // subscription/plan selected
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
  expectedIncome?: ExpectedIncomeRange;
}

/**
 * Simplified onboarding request data structure
 * Used for the new quick onboarding flow (30-45s)
 */
export interface SimplifiedOnboardingRequest {
  goals: UserGoal[]; // User can select multiple goals
  householdType: HouseholdType;
  incomeRange?: ExpectedIncomeRange | null; // Optional
  incomeAmount?: number | null; // Optional custom amount
  location?: {
    country: string;
    stateOrProvince: string | null;
  } | null; // Optional
}

/**
 * Complete onboarding request data structure
 * Used when submitting all onboarding steps at once (legacy)
 */
export interface CompleteOnboardingRequest {
  step1: {
    name: string;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
    avatarUrl?: string | null;
  };
  step2: {
    incomeRange: ExpectedIncomeRange;
    incomeAmount?: number | null;
    location?: {
      country: string;
      stateOrProvince: string | null;
    } | null;
    ruleType?: BudgetRuleType | string;
  };
  step3: {
    planId: string;
    interval: "month" | "year";
  };
}
