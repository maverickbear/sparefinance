/**
 * Onboarding Domain Types
 * Pure domain types for onboarding feature
 */

import { BudgetRuleType } from "../budgets/budget-rules.types";

export type ExpectedIncomeRange = "0-50k" | "50k-100k" | "100k-150k" | "150k-250k" | "250k+" | null;

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
 * Complete onboarding request data structure
 * Used when submitting all onboarding steps at once
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

