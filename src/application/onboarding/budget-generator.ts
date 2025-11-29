/**
 * Budget Generator
 * Generates initial budgets based on expected income
 */

import { makeBudgetsService } from "../budgets/budgets.factory";
import { CategoryHelper } from "./category-helper";
import { BaseBudget } from "../../domain/budgets/budgets.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";

// Standard budget percentages based on income
export const BUDGET_PERCENTAGES = {
  HOUSING: 0.30, // 30%
  GROCERIES: 0.12, // 12%
  TRANSPORTATION: 0.10, // 10%
  DINING_OUT: 0.08, // 8%
  HEALTH: 0.05, // 5%
  PERSONAL: 0.05, // 5%
  SAVINGS: 0.20, // 20%
  OTHER: 0.10, // 10%
} as const;

// Category name mappings
const CATEGORY_MAPPINGS = {
  HOUSING: ["Rent", "Rent / Mortgage", "Utilities"],
  GROCERIES: ["Groceries"],
  TRANSPORTATION: ["Vehicle", "Public Transit"],
  DINING_OUT: ["Restaurants", "Dining Out"],
  HEALTH: ["Medical", "Healthcare"],
  PERSONAL: ["Personal Care"],
  SAVINGS: ["Savings", "Emergency Fund"],
  OTHER: ["Other", "Misc"],
} as const;

// Group name mappings
const GROUP_MAPPINGS = {
  HOUSING: "Housing",
  GROCERIES: "Food",
  TRANSPORTATION: "Transportation",
  DINING_OUT: "Food",
  HEALTH: "Health",
  PERSONAL: "Personal",
  SAVINGS: "Savings",
  OTHER: "Misc",
} as const;

export class BudgetGenerator {
  constructor(
    private categoryHelper: CategoryHelper
  ) {}

  /**
   * Generate initial budgets based on monthly income
   */
  async generateInitialBudgets(
    userId: string,
    monthlyIncome: number,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseBudget[]> {
    const budgetsService = makeBudgetsService();
    const createdBudgets: BaseBudget[] = [];
    const currentMonth = new Date();
    const periodStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    // Generate budgets for each category
    for (const [key, percentage] of Object.entries(BUDGET_PERCENTAGES)) {
      const budgetAmount = monthlyIncome * percentage;
      const categoryNames = CATEGORY_MAPPINGS[key as keyof typeof CATEGORY_MAPPINGS];
      const groupName = GROUP_MAPPINGS[key as keyof typeof GROUP_MAPPINGS];

      // Try to find or create the first available category
      let category: { id: string } | null = null;
      for (const categoryName of categoryNames) {
        const found = await this.categoryHelper.findOrCreateCategory(
          categoryName,
          groupName,
          userId,
          accessToken,
          refreshToken
        );
        if (found) {
          category = { id: found.id };
          break;
        }
      }

      if (!category) {
        logger.warn(`[BudgetGenerator] Could not find or create category for ${key}, skipping`);
        continue;
      }

      try {
        // Create budget for current month
        // Note: BudgetsService.createBudget doesn't accept note parameter
        // We'll mark budgets as pre-filled by checking if they were created during onboarding
        const budget = await budgetsService.createBudget({
          period: periodStart,
          categoryId: category.id,
          amount: budgetAmount,
        });

        createdBudgets.push(budget);
      } catch (error) {
        // Budget might already exist, skip it
        logger.warn(`[BudgetGenerator] Could not create budget for ${key}:`, error);
      }
    }

    logger.info(`[BudgetGenerator] Created ${createdBudgets.length} initial budgets for user ${userId}`);
    return createdBudgets;
  }
}

