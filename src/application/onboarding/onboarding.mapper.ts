/**
 * Onboarding Mapper
 * Maps household settings JSONB ↔ domain types
 */

import { HouseholdSettings } from "../../domain/household/household.types";
import { ExpectedIncomeRange } from "../../domain/onboarding/onboarding.types";

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
    };
  }

  /**
   * Map domain HouseholdSettings to database JSONB format
   */
  static settingsToDatabase(settings: HouseholdSettings): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (settings.expectedIncome !== undefined) {
      result.expectedIncome = settings.expectedIncome;
    }

    return result;
  }
}

