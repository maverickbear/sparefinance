/**
 * Onboarding Factory
 * Dependency injection factory for OnboardingService
 */

import { OnboardingService } from "./onboarding.service";
import { HouseholdRepository } from "@/src/infrastructure/database/repositories/household.repository";
import { BudgetGenerator } from "./budget-generator";
import { CategoryHelper } from "./category-helper";

/**
 * Create an OnboardingService instance with all dependencies
 */
export function makeOnboardingService(): OnboardingService {
  const householdRepository = new HouseholdRepository();
  const categoryHelper = new CategoryHelper();
  const budgetGenerator = new BudgetGenerator(categoryHelper);
  return new OnboardingService(householdRepository, budgetGenerator, categoryHelper);
}

