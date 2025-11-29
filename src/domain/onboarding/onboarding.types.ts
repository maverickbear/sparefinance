/**
 * Onboarding Domain Types
 * Pure domain types for onboarding feature
 */

export type ExpectedIncomeRange = "0-50k" | "50k-100k" | "100k-150k" | "150k-250k" | "250k+" | null;

export interface OnboardingStatusExtended {
  hasAccount: boolean;
  hasCompleteProfile: boolean;
  hasExpectedIncome: boolean;
  completedCount: number;
  totalCount: number;
  totalBalance?: number;
}

