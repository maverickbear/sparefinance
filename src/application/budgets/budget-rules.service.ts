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
  GroupToRuleCategoryMapping
} from "../../domain/budgets/budget-rules.types";
import {
  BUDGET_RULE_PROFILES,
  getAvailableBudgetRules,
  getBudgetRuleById,
  mapGroupNameToRuleCategory
} from "../../domain/budgets/budget-rules.constants";
import { BaseGroup } from "../../domain/categories/categories.types";
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
   * Suggest a budget rule based on monthly income and optional city cost
   */
  suggestRule(monthlyIncome: number, cityCost?: "high" | "medium" | "low"): BudgetRuleSuggestion {
    // Default to 50/30/20 for most users
    let suggestedRule: BudgetRuleProfile = BUDGET_RULE_PROFILES["50_30_20"];
    let explanation = "The 50/30/20 rule is the most popular and works well for most people.";
    let confidence: "high" | "medium" | "low" = "high";

    // High-cost cities should use 40/30/20/10
    if (cityCost === "high") {
      suggestedRule = BUDGET_RULE_PROFILES["40_30_20_10"];
      explanation = "Since you're in a high-cost city, the 40/30/20/10 rule better reflects housing costs while maintaining investment focus.";
      confidence = "high";
    }
    // Very high income might benefit from Pay Yourself First
    else if (monthlyIncome > 10000) {
      suggestedRule = BUDGET_RULE_PROFILES["PAY_YOURSELF_FIRST"];
      explanation = "With your income level, the Pay Yourself First rule can help you build wealth faster by prioritizing investments.";
      confidence = "medium";
    }
    // Lower income might benefit from 60% Fixed Costs for stability
    else if (monthlyIncome < 3000) {
      suggestedRule = BUDGET_RULE_PROFILES["60_FIXED"];
      explanation = "The 60% Fixed Costs rule provides stability and predictability, which is helpful with lower income.";
      confidence = "medium";
    }

    return {
      rule: suggestedRule,
      explanation,
      confidence,
    };
  }

  /**
   * Map Groups to rule categories using default mappings
   * Currently only includes "Food & Drinks" group
   */
  mapGroupsToRuleCategories(groups: BaseGroup[]): GroupToRuleCategoryMapping[] {
    return groups
      .filter(group => {
        // Only include "Food & Drinks" group
        const groupName = group.name.toLowerCase().trim();
        return (group.type === "expense" || group.type === null) && 
               (groupName === "food & drinks" || groupName === "food and drinks");
      })
      .map(group => ({
        groupId: group.id,
        groupName: group.name,
        ruleCategory: mapGroupNameToRuleCategory(group.name),
      }))
      .filter((mapping): mapping is GroupToRuleCategoryMapping => mapping.ruleCategory !== null);
  }

  /**
   * Calculate budget amounts per Group based on rule and monthly income
   */
  calculateBudgetAmounts(
    rule: BudgetRuleProfile,
    monthlyIncome: number,
    groupMappings: GroupToRuleCategoryMapping[]
  ): Array<{ groupId: string; amount: number; ruleCategory: BudgetRuleCategory }> {
    const budgets: Array<{ groupId: string; amount: number; ruleCategory: BudgetRuleCategory }> = [];

    // Group mappings by rule category
    const groupsByCategory = new Map<BudgetRuleCategory, GroupToRuleCategoryMapping[]>();
    for (const mapping of groupMappings) {
      const category = mapping.ruleCategory;
      if (!groupsByCategory.has(category)) {
        groupsByCategory.set(category, []);
      }
      groupsByCategory.get(category)!.push(mapping);
    }

    // Calculate total amount per category
    const categoryAmounts = new Map<BudgetRuleCategory, number>();
    for (const [category, percentage] of Object.entries(rule.percentages)) {
      if (percentage > 0) {
        categoryAmounts.set(category as BudgetRuleCategory, monthlyIncome * percentage);
      }
    }

    // Distribute amount evenly among groups in each category
    for (const [category, amount] of categoryAmounts.entries()) {
      const groups = groupsByCategory.get(category) || [];
      if (groups.length > 0) {
        const amountPerGroup = amount / groups.length;
        for (const group of groups) {
          budgets.push({
            groupId: group.groupId,
            amount: Math.round(amountPerGroup * 100) / 100, // Round to 2 decimals
            ruleCategory: category,
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
    groupMappings: GroupToRuleCategoryMapping[],
    categoriesMap?: Map<string, { groupId?: string | null }> // Optional map of categoryId to category with groupId
  ): BudgetRuleValidation {
    const alerts: BudgetRuleValidation["alerts"] = [];

    if (monthlyIncome <= 0) {
      return { isValid: true, alerts: [] };
    }

    // Calculate actual spending by rule category
    const spendingByCategory = new Map<BudgetRuleCategory, number>();
    const groupToRuleCategoryMap = new Map<string, BudgetRuleCategory>();

    // Build map of groupId to rule category
    for (const mapping of groupMappings) {
      groupToRuleCategoryMap.set(mapping.groupId, mapping.ruleCategory);
    }

    // Build map of categoryId to groupId from budgets
    const categoryToGroupMap = new Map<string, string>();
    for (const budget of budgets) {
      if (budget.categoryId && budget.groupId) {
        categoryToGroupMap.set(budget.categoryId, budget.groupId);
      }
      // Also map via category relation if available
      if (budget.category?.groupId) {
        categoryToGroupMap.set(budget.categoryId || '', budget.category.groupId);
      }
    }

    // Also use provided categories map if available
    if (categoriesMap) {
      for (const [categoryId, category] of categoriesMap.entries()) {
        if (category.groupId) {
          categoryToGroupMap.set(categoryId, category.groupId);
        }
      }
    }

    // Calculate spending from transactions
    for (const transaction of transactions) {
      if (transaction.type !== "expense" || !transaction.categoryId) continue;

      // Find the category's group to determine rule category
      const groupId = categoryToGroupMap.get(transaction.categoryId);
      
      if (groupId) {
        const ruleCategory = groupToRuleCategoryMap.get(groupId);
        if (ruleCategory) {
          const current = spendingByCategory.get(ruleCategory) || 0;
          spendingByCategory.set(ruleCategory, current + Math.abs(transaction.amount));
        }
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

