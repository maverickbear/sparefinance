/**
 * Onboarding Mapper
 * Maps household settings JSONB ↔ domain types
 */

import { HouseholdSettings } from "../../domain/household/household.types";
import { ExpectedIncomeRange } from "../../domain/onboarding/onboarding.types";
import { BudgetRuleType } from "../../domain/budgets/budget-rules.types";

export class OnboardingMapper {
  /**
   * Map database settings JSONB to domain HouseholdSettings
   */
  static settingsToDomain(settings: Record<string, unknown> | null): HouseholdSettings {
    if (!settings) {
      return {};
    }

    return {
      expectedIncome: (settings.expectedIncome as ExpectedIncomeRange) || undefined,
      expectedIncomeAmount: typeof settings.expectedIncomeAmount === 'number' 
        ? settings.expectedIncomeAmount 
        : undefined,
      country: typeof settings.country === 'string' ? settings.country : undefined,
      stateOrProvince: typeof settings.stateOrProvince === 'string' ? settings.stateOrProvince : undefined,
      budgetRule: (settings.budgetRule as BudgetRuleType) || undefined,
      onboardingCompletedAt: typeof settings.onboardingCompletedAt === 'string' ? settings.onboardingCompletedAt : undefined,
      onboardingGoals: Array.isArray(settings.onboardingGoals) ? settings.onboardingGoals as string[] : undefined,
      onboardingHouseholdType: (settings.onboardingHouseholdType === "personal" || settings.onboardingHouseholdType === "shared") 
        ? settings.onboardingHouseholdType 
        : undefined,
    };
  }

  /**
   * Map domain HouseholdSettings to database JSONB format
   */
  static settingsToDatabase(settings: HouseholdSettings & Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (settings.expectedIncome !== undefined) {
      result.expectedIncome = settings.expectedIncome;
    }

    if (settings.expectedIncomeAmount !== undefined) {
      result.expectedIncomeAmount = settings.expectedIncomeAmount;
    }

    if (settings.country !== undefined) {
      result.country = settings.country;
    }

    if (settings.stateOrProvince !== undefined) {
      result.stateOrProvince = settings.stateOrProvince;
    }

    if (settings.budgetRule !== undefined) {
      result.budgetRule = settings.budgetRule;
    }

    if (settings.onboardingCompletedAt !== undefined) {
      result.onboardingCompletedAt = settings.onboardingCompletedAt;
    }

    if (settings.onboardingGoals !== undefined) {
      result.onboardingGoals = settings.onboardingGoals;
    }

    if (settings.onboardingHouseholdType !== undefined) {
      result.onboardingHouseholdType = settings.onboardingHouseholdType;
    }

    // Include any additional custom fields
    Object.keys(settings).forEach(key => {
      if (!['expectedIncome', 'expectedIncomeAmount', 'country', 'stateOrProvince', 'budgetRule', 'onboardingCompletedAt', 'onboardingGoals', 'onboardingHouseholdType'].includes(key)) {
        result[key] = settings[key];
      }
    });

    return result;
  }
}

