/**
 * Household Domain Types
 * Pure domain types for household feature
 */

import { ExpectedIncomeRange } from "../onboarding/onboarding.types";

export interface HouseholdSettings {
  expectedIncome?: ExpectedIncomeRange;
}

