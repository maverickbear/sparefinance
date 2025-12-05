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
   * If no rule is provided, defaults to 50/30/20 rule
   * If location is provided, uses after-tax income for more accurate budgets
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

    // Use provided rule or default to 50/30/20
    const selectedRule: BudgetRuleProfile = ruleType 
      ? (getBudgetRuleById(ruleType) || BUDGET_RULE_PROFILES["50_30_20"])
      : BUDGET_RULE_PROFILES["50_30_20"];

    logger.info(`[BudgetGenerator] Using budget rule: ${selectedRule.name} for user ${userId}`);

    // Calculate after-tax income if location is available
    let incomeToUse = monthlyIncome;
    if (country && stateOrProvince) {
      try {
        const { makeTaxesService } = await import("../taxes/taxes.factory");
        const taxesService = makeTaxesService();
        const annualIncome = monthlyIncome * 12;
        const monthlyAfterTax = await taxesService.calculateMonthlyAfterTaxIncome(
          country,
          annualIncome,
          stateOrProvince
        );
        incomeToUse = monthlyAfterTax;
        logger.info(`[BudgetGenerator] Using after-tax income: $${monthlyAfterTax.toFixed(2)}/month (from $${monthlyIncome.toFixed(2)}/month gross)`);
      } catch (error) {
        logger.warn(`[BudgetGenerator] Failed to calculate after-tax income, using gross income:`, error);
        // Continue with gross income if tax calculation fails
      }
    }

    // Get all groups to map to rule categories
    const groups = await categoriesService.getGroups(accessToken, refreshToken);
    const groupMappings = budgetRulesService.mapGroupsToRuleCategories(groups);

    // Calculate budget amounts per group based on rule
    const budgetAmounts = budgetRulesService.calculateBudgetAmounts(
      selectedRule,
      incomeToUse,
      groupMappings
    );

    // Create budgets for each group
    for (const { groupId, amount, ruleCategory } of budgetAmounts) {
      if (amount <= 0) {
        continue; // Skip zero or negative amounts
      }

      try {
        // Create budget for the group
        // Using groupId creates a grouped budget that applies to all categories in that group
        const budget = await budgetsService.createBudget({
          period: periodStart,
          groupId: groupId,
          amount: amount,
        });

        createdBudgets.push(budget);
        logger.debug(`[BudgetGenerator] Created budget for group ${groupId} (${ruleCategory}): $${amount}`);
      } catch (error) {
        // Budget might already exist, skip it silently
        const isAppError = error && typeof error === 'object' && 'statusCode' in error;
        const is409Error = isAppError && (error as any).statusCode === 409;
        const isAlreadyExistsError = error instanceof Error && error.message.includes("already exists");
        
        if (is409Error || isAlreadyExistsError) {
          logger.debug(`[BudgetGenerator] Budget already exists for group ${groupId}, skipping`);
        } else {
          logger.warn(`[BudgetGenerator] Could not create budget for group ${groupId}:`, error);
        }
      }
    }

    logger.info(`[BudgetGenerator] Created ${createdBudgets.length} initial budgets using ${selectedRule.name} rule for user ${userId}`);
    return createdBudgets;
  }
}
