/**
 * Budget Generator
 * Generates initial budgets based on expected income and budget rules
 */

import { makeBudgetsService } from "../budgets/budgets.factory";
import { makeBudgetRulesService } from "../budgets/budget-rules.factory";
import { makeCategoriesService } from "../categories/categories.factory";
import { CategoryHelper } from "./category-helper";
import { BaseBudget } from "../../domain/budgets/budgets.types";
import { BudgetRuleType, BudgetRuleProfile } from "../../domain/budgets/budget-rules.types";
import { getBudgetRuleById, BUDGET_RULE_PROFILES } from "../../domain/budgets/budget-rules.constants";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

export class BudgetGenerator {
  constructor(
    private categoryHelper: CategoryHelper
  ) {}

  /**
   * Generate initial budgets based on monthly income and optional budget rule
   * IMPORTANT: Always uses income from onboarding to ensure calculations are based on user's declared income
   * If no rule is provided, defaults to 50/30/20 rule
   * If location is available, uses after-tax income for more accurate budgets
   */
  async generateInitialBudgets(
    userId: string,
    monthlyIncome: number,
    accessToken?: string,
    refreshToken?: string,
    ruleType?: BudgetRuleType,
    country?: string | null,
    stateOrProvince?: string | null
  ): Promise<BaseBudget[]> {
    const budgetsService = makeBudgetsService();
    const budgetRulesService = makeBudgetRulesService();
    const categoriesService = makeCategoriesService();
    const createdBudgets: BaseBudget[] = [];
    const currentMonth = new Date();
    const periodStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    // CRITICAL: Always fetch income from onboarding to ensure we use the user's declared income
    // This guarantees budgets are calculated based on what the user entered during onboarding
    let incomeFromOnboarding: number;
    try {
      const { makeOnboardingService } = await import("../onboarding/onboarding.factory");
      const onboardingService = makeOnboardingService();
      const { incomeRange, incomeAmount } = await onboardingService.getExpectedIncomeWithAmount(userId, accessToken, refreshToken);
      
      if (!incomeRange) {
        logger.warn(`[BudgetGenerator] No income found in onboarding for user ${userId}, using provided monthlyIncome as fallback`);
        incomeFromOnboarding = monthlyIncome;
      } else {
        // Calculate monthly income from onboarding (respects custom amount if provided)
        incomeFromOnboarding = onboardingService.getMonthlyIncomeFromRange(incomeRange, incomeAmount);
        if (incomeFromOnboarding === 0) {
          logger.warn(`[BudgetGenerator] Invalid income from onboarding for user ${userId}, using provided monthlyIncome as fallback`);
          incomeFromOnboarding = monthlyIncome;
        } else {
          logger.info(`[BudgetGenerator] Using income from onboarding: $${incomeFromOnboarding.toFixed(2)}/month (range: ${incomeRange}${incomeAmount ? `, custom: $${incomeAmount}/year` : ''})`);
        }
      }
    } catch (error) {
      logger.warn(`[BudgetGenerator] Error fetching income from onboarding, using provided monthlyIncome as fallback:`, error);
      incomeFromOnboarding = monthlyIncome;
    }

    // Use provided rule or default to 50/30/20
    const selectedRule: BudgetRuleProfile = ruleType 
      ? (getBudgetRuleById(ruleType) || BUDGET_RULE_PROFILES["50_30_20"])
      : BUDGET_RULE_PROFILES["50_30_20"];

    logger.info(`[BudgetGenerator] Using budget rule: ${selectedRule.name} for user ${userId} with income: $${incomeFromOnboarding.toFixed(2)}/month`);

    // Calculate after-tax income if location is available
    // Use income from onboarding (not the parameter) to ensure consistency
    let incomeToUse = incomeFromOnboarding;
    if (country && stateOrProvince) {
      try {
        const { makeTaxesService } = await import("../taxes/taxes.factory");
        const taxesService = makeTaxesService();
        const annualIncome = incomeFromOnboarding * 12;
        const monthlyAfterTax = await taxesService.calculateMonthlyAfterTaxIncome(
          country,
          annualIncome,
          stateOrProvince
        );
        incomeToUse = monthlyAfterTax;
        logger.info(`[BudgetGenerator] Using after-tax income: $${monthlyAfterTax.toFixed(2)}/month (from $${incomeFromOnboarding.toFixed(2)}/month gross from onboarding)`);
      } catch (error) {
        logger.warn(`[BudgetGenerator] Failed to calculate after-tax income, using gross income from onboarding:`, error);
        // Continue with gross income from onboarding if tax calculation fails
      }
    }

    // Get all categories to map to rule categories
    const allCategories = await categoriesService.getAllCategories();
    const categoryMappings = budgetRulesService.mapCategoriesToRuleCategories(allCategories);

    // Calculate budget amounts per category based on rule
    const budgetAmounts = budgetRulesService.calculateBudgetAmounts(
      selectedRule,
      incomeToUse,
      categoryMappings
    );

    // Get all categories (already fetched above, but keeping for clarity)
    
    /**
     * Restaurant budget profiles based on income after taxes
     * These percentages represent healthy dining out budgets that don't compromise financial goals
     */
    type RestaurantBudgetProfile = "ideal" | "balanced" | "comfortable";
    
    const RESTAURANT_BUDGET_PROFILES: Record<RestaurantBudgetProfile, number> = {
      ideal: 0.05,      // 5% - For prioritizing goals, debt control, maximizing savings
      balanced: 0.075,  // 7.5% - Balance between social life and financial health (most common)
      comfortable: 0.10, // 10% - For those who love dining out, busy routine, stable finances
    };
    
    // Use "balanced" as default - provides good balance for most users
    const restaurantProfile: RestaurantBudgetProfile = "balanced";
    const restaurantPercentage = RESTAURANT_BUDGET_PROFILES[restaurantProfile];
    
    // Specific categories to create budgets for
    // Budget is calculated as percentage of income after taxes (not group budget)
    const specificCategoryConfigs: Array<{ 
      categoryId: string; 
      percentageOfIncome: number; 
      name: string;
      profile?: RestaurantBudgetProfile;
    }> = [
      { 
        categoryId: "cat_1764909744605_kb1vi312v", // Restaurants
        percentageOfIncome: restaurantPercentage, // 7.5% of income after taxes (balanced profile)
        name: "Restaurants",
        profile: restaurantProfile
      },
    ];
    
    // Create budgets for specific categories first
    for (const config of specificCategoryConfigs) {
      const category = allCategories.find(cat => cat.id === config.categoryId);
      if (!category) {
        logger.warn(`[BudgetGenerator] Category ${config.categoryId} not found, skipping`);
        continue;
      }
      
      // Calculate category budget as percentage of income after taxes
      // This ensures a healthy allocation that doesn't compromise financial goals
      const categoryBudgetAmount = Math.round(incomeToUse * config.percentageOfIncome * 100) / 100;
      
      if (categoryBudgetAmount <= 0) {
        logger.warn(`[BudgetGenerator] Calculated budget amount for category ${config.categoryId} is zero or negative, skipping`);
        continue;
      }
      
      // Warn if percentage is above 10% (may compromise financial goals)
      if (config.percentageOfIncome > 0.10) {
        logger.warn(`[BudgetGenerator] Restaurant budget is ${(config.percentageOfIncome * 100).toFixed(1)}% of income - above 10% may compromise financial goals`);
      }
      
      try {
        // Create budget for the specific category
        // Budget is based on income percentage
        const budget = await budgetsService.createBudget({
          period: periodStart,
          categoryId: config.categoryId,
          amount: categoryBudgetAmount,
        });

        createdBudgets.push(budget);
        const profileInfo = config.profile ? ` (${config.profile} profile)` : '';
        logger.info(`[BudgetGenerator] Created budget for ${config.name}${profileInfo}: $${categoryBudgetAmount}/month (${(config.percentageOfIncome * 100).toFixed(1)}% of income after taxes: $${incomeToUse.toFixed(2)}/month)`);
      } catch (error) {
        // Budget might already exist, skip it silently
        const isAppError = error && typeof error === 'object' && 'statusCode' in error;
        const is409Error = isAppError && (error as any).statusCode === 409;
        const isAlreadyExistsError = error instanceof Error && error.message.includes("already exists");
        
        if (is409Error || isAlreadyExistsError) {
          logger.debug(`[BudgetGenerator] Budget already exists for category ${config.categoryId}, skipping`);
        } else {
          logger.warn(`[BudgetGenerator] Could not create budget for category ${config.categoryId}:`, error);
        }
      }
    }
    
    // Create budgets for remaining categories (excluding categories that have specific budgets)
    const categoriesWithSpecificBudgets = new Set(
      specificCategoryConfigs.map(config => config.categoryId)
    );
    
    for (const { categoryId, amount, ruleCategory } of budgetAmounts) {
      // Skip categories that have specific budgets
      if (categoriesWithSpecificBudgets.has(categoryId)) {
        logger.debug(`[BudgetGenerator] Skipping category ${categoryId} - has specific budget`);
        continue;
      }
      
      if (amount <= 0) {
        continue; // Skip zero or negative amounts
      }

      try {
        // Create budget for the category
        const budget = await budgetsService.createBudget({
          period: periodStart,
          categoryId: categoryId,
          amount: amount,
        });

        createdBudgets.push(budget);
        logger.debug(`[BudgetGenerator] Created budget for category ${categoryId} (${ruleCategory}): $${amount}`);
      } catch (error) {
        // Budget might already exist, skip it silently
        const isAppError = error && typeof error === 'object' && 'statusCode' in error;
        const is409Error = isAppError && (error as any).statusCode === 409;
        const isAlreadyExistsError = error instanceof Error && error.message.includes("already exists");
        
        if (is409Error || isAlreadyExistsError) {
          logger.debug(`[BudgetGenerator] Budget already exists for category ${categoryId}, skipping`);
        } else {
          logger.warn(`[BudgetGenerator] Could not create budget for category ${categoryId}:`, error);
        }
      }
    }

    logger.info(`[BudgetGenerator] Created ${createdBudgets.length} initial budgets using ${selectedRule.name} rule for user ${userId}`);
    return createdBudgets;
  }
}
