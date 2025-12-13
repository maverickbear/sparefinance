/**
 * Budget Rules Service
 * Business logic for budget rule management and validation
 */

import { 
  BudgetRuleType, 
  BudgetRuleProfile, 
  BudgetRuleCategory,
  BudgetRuleSuggestion,
  BudgetRuleValidation,
  CategoryToRuleCategoryMapping
} from "../../domain/budgets/budget-rules.types";
import {
  BUDGET_RULE_PROFILES,
  getAvailableBudgetRules,
  getBudgetRuleById,
  mapCategoryNameToRuleCategory
} from "../../domain/budgets/budget-rules.constants";
import { BaseCategory } from "../../domain/categories/categories.types";
import { BudgetWithRelations } from "../../domain/budgets/budgets.types";
import { BaseTransaction } from "../../domain/transactions/transactions.types";

export class BudgetRulesService {
  /**
   * Get all available budget rule profiles
   */
  getAvailableRules(): BudgetRuleProfile[] {
    return getAvailableBudgetRules();
  }

  /**
   * Get a budget rule profile by ID
   */
  getRuleById(id: BudgetRuleType): BudgetRuleProfile | null {
    return getBudgetRuleById(id);
  }

  /**
   * Suggest a budget rule based on monthly income
   * 
   * SIMPLIFIED: Removed cityCost parameter and complex logic.
   * Now uses only 2 simple profiles: 50/30/20 (default) and Pay Yourself First (high income).
   */
  suggestRule(monthlyIncome: number): BudgetRuleSuggestion {
    // Simple logic: Pay Yourself First for high income, 50/30/20 for everyone else
    if (monthlyIncome > 8000) {
      return {
        rule: BUDGET_RULE_PROFILES["PAY_YOURSELF_FIRST"],
        explanation: "With your income level, the Pay Yourself First rule can help you build wealth faster by prioritizing investments.",
        confidence: "high",
      };
    }

    // Default to 50/30/20 for most users
    return {
      rule: BUDGET_RULE_PROFILES["50_30_20"],
      explanation: "The 50/30/20 rule is the most popular and works well for most people.",
      confidence: "high",
    };
  }

  /**
   * Map Categories to rule categories using default mappings
   * Currently only includes "Food & Drinks" category
   */
  mapCategoriesToRuleCategories(categories: BaseCategory[]): CategoryToRuleCategoryMapping[] {
    return categories
      .filter(category => {
        // Only include "Food & Drinks" category
        const categoryName = category.name.toLowerCase().trim();
        return (category.type === "expense" || category.type === null) && 
               (categoryName === "food & drinks" || categoryName === "food and drinks");
      })
      .map(category => ({
        categoryId: category.id,
        categoryName: category.name,
        ruleCategory: mapCategoryNameToRuleCategory(category.name),
      }))
      .filter((mapping): mapping is CategoryToRuleCategoryMapping => mapping.ruleCategory !== null);
  }

  /**
   * Calculate budget amounts per Category based on rule and monthly income
   */
  calculateBudgetAmounts(
    rule: BudgetRuleProfile,
    monthlyIncome: number,
    categoryMappings: CategoryToRuleCategoryMapping[]
  ): Array<{ categoryId: string; amount: number; ruleCategory: BudgetRuleCategory }> {
    const budgets: Array<{ categoryId: string; amount: number; ruleCategory: BudgetRuleCategory }> = [];

    // Category mappings by rule category
    const categoriesByRuleCategory = new Map<BudgetRuleCategory, CategoryToRuleCategoryMapping[]>();
    for (const mapping of categoryMappings) {
      const ruleCategory = mapping.ruleCategory;
      if (!categoriesByRuleCategory.has(ruleCategory)) {
        categoriesByRuleCategory.set(ruleCategory, []);
      }
      categoriesByRuleCategory.get(ruleCategory)!.push(mapping);
    }

    // Calculate total amount per rule category
    const categoryAmounts = new Map<BudgetRuleCategory, number>();
    for (const [category, percentage] of Object.entries(rule.percentages)) {
      if (percentage > 0) {
        categoryAmounts.set(category as BudgetRuleCategory, monthlyIncome * percentage);
      }
    }

    // Distribute amount evenly among categories in each rule category
    for (const [ruleCategory, amount] of categoryAmounts.entries()) {
      const categories = categoriesByRuleCategory.get(ruleCategory) || [];
      if (categories.length > 0) {
        const amountPerCategory = amount / categories.length;
        for (const category of categories) {
          budgets.push({
            categoryId: category.categoryId,
            amount: Math.round(amountPerCategory * 100) / 100, // Round to 2 decimals
            ruleCategory: ruleCategory,
          });
        }
      }
    }

    return budgets;
  }

  /**
   * Validate actual spending against rule and return alerts
   */
  validateBudgetAgainstRule(
    budgets: BudgetWithRelations[],
    transactions: BaseTransaction[],
    rule: BudgetRuleProfile,
    monthlyIncome: number,
    categoryMappings: CategoryToRuleCategoryMapping[]
  ): BudgetRuleValidation {
    const alerts: BudgetRuleValidation["alerts"] = [];

    if (monthlyIncome <= 0) {
      return { isValid: true, alerts: [] };
    }

    // Calculate actual spending by rule category
    const spendingByCategory = new Map<BudgetRuleCategory, number>();
    const categoryToRuleCategoryMap = new Map<string, BudgetRuleCategory>();

    // Build map of categoryId to rule category
    for (const mapping of categoryMappings) {
      categoryToRuleCategoryMap.set(mapping.categoryId, mapping.ruleCategory);
    }

    // Calculate spending from transactions
    for (const transaction of transactions) {
      if (transaction.type !== "expense" || !transaction.categoryId) continue;

      // Find the category's rule category directly
      const ruleCategory = categoryToRuleCategoryMap.get(transaction.categoryId);
      if (ruleCategory) {
        const current = spendingByCategory.get(ruleCategory) || 0;
        spendingByCategory.set(ruleCategory, current + Math.abs(transaction.amount));
      }
    }

    // Validate each rule category
    for (const [category, targetPercentage] of Object.entries(rule.percentages)) {
      if (targetPercentage <= 0) continue;

      const ruleCategory = category as BudgetRuleCategory;
      const actualSpending = spendingByCategory.get(ruleCategory) || 0;
      const actualPercentage = (actualSpending / monthlyIncome) * 100;
      const deviation = actualPercentage - (targetPercentage * 100);

      // Generate alerts if deviation is significant
      if (Math.abs(deviation) > 5) {
        const severity = Math.abs(deviation) > 10 ? "critical" : "warning";
        
        let title = "";
        let description = "";

        if (ruleCategory === "housing") {
          title = "Housing Spending Alert";
          description = `You're spending ${actualPercentage.toFixed(1)}% on housing. The ideal is ${(targetPercentage * 100).toFixed(0)}%.`;
        } else if (ruleCategory === "future") {
          title = "Investment/Savings Alert";
          description = `You've allocated ${actualPercentage.toFixed(1)}% to future goals. The target is ${(targetPercentage * 100).toFixed(0)}%.`;
        } else if (ruleCategory === "needs") {
          title = "Needs Spending Alert";
          description = `You're spending ${actualPercentage.toFixed(1)}% on needs. The target is ${(targetPercentage * 100).toFixed(0)}%.`;
        } else if (ruleCategory === "lifestyle") {
          title = "Lifestyle Spending Alert";
          description = `You're spending ${actualPercentage.toFixed(1)}% on lifestyle. The target is ${(targetPercentage * 100).toFixed(0)}%.`;
        } else if (ruleCategory === "other_needs") {
          title = "Other Needs Spending Alert";
          description = `You're spending ${actualPercentage.toFixed(1)}% on other needs. The target is ${(targetPercentage * 100).toFixed(0)}%.`;
        }

        alerts.push({
          id: `budget_rule_${ruleCategory}_${Date.now()}`,
          title,
          description,
          severity,
          category: ruleCategory,
          actualPercentage,
          targetPercentage: targetPercentage * 100,
        });
      }
    }

    return {
      isValid: alerts.length === 0,
      alerts,
    };
  }
}

