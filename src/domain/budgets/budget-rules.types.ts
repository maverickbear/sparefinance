/**
 * Domain types for budget rules
 * Pure TypeScript types with no external dependencies
 */

export type BudgetRuleType = "50_30_20" | "40_30_20_10" | "60_FIXED" | "PAY_YOURSELF_FIRST";

export type BudgetRuleCategory = "needs" | "lifestyle" | "future" | "housing" | "other_needs";

export interface BudgetRuleProfile {
  id: BudgetRuleType;
  name: string;
  description: string;
  percentages: Record<BudgetRuleCategory, number>;
  recommendedFor: string;
}

export interface CategoryToRuleCategoryMapping {
  categoryId: string;
  categoryName: string;
  ruleCategory: BudgetRuleCategory;
}

export interface BudgetRuleSuggestion {
  rule: BudgetRuleProfile;
  explanation: string;
  confidence: "high" | "medium" | "low";
}

export interface BudgetRuleValidation {
  isValid: boolean;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: "critical" | "warning" | "info";
    category: BudgetRuleCategory;
    actualPercentage: number;
    targetPercentage: number;
  }>;
}

