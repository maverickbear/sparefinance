/**
 * Household Domain Types
 * Pure domain types for household feature
 */

import { ExpectedIncomeRange } from "../onboarding/onboarding.types";
import { BudgetRuleType } from "../budgets/budget-rules.types";

export interface HouseholdSettings {
  expectedIncome?: ExpectedIncomeRange;
  expectedIncomeAmount?: number | null; // Exact numeric value when user provides custom amount
  country?: string | null; // ISO 3166-1 alpha-2 country code (e.g., "US", "CA")
  stateOrProvince?: string | null; // State/province code (e.g., "CA", "ON")
  budgetRule?: BudgetRuleType | null; // Selected budget rule type
}

