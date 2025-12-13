/**
 * Budget rules constants
 * Universal budget rules used by financial planners
 */

import { BudgetRuleProfile, BudgetRuleCategory } from "./budget-rules.types";

/**
 * Budget rule profiles with their percentage distributions
 */
export const BUDGET_RULE_PROFILES: Record<string, BudgetRuleProfile> = {
  "50_30_20": {
    id: "50_30_20",
    name: "Starter Budget (50/30/20)",
    description: "The most popular rule recommended by Harvard, CFPs, and financial apps. Perfect for singles and families.",
    percentages: {
      needs: 0.50,
      lifestyle: 0.30,
      future: 0.20,
      housing: 0,
      other_needs: 0,
    },
    recommendedFor: "Most users",
  },
  "40_30_20_10": {
    id: "40_30_20_10",
    name: "High-Cost City Budget (40/30/20/10)",
    description: "Used by financial planners in expensive cities. Reflects higher housing costs while maintaining investment focus.",
    percentages: {
      housing: 0.40,
      other_needs: 0.30,
      future: 0.20,
      lifestyle: 0.10,
      needs: 0,
    },
    recommendedFor: "High-cost cities (Toronto, Vancouver, NYC, SF)",
  },
  "60_FIXED": {
    id: "60_FIXED",
    name: "Family Stability Budget (60% Fixed Costs)",
    description: "Ideal for families with children. Provides predictability and stability while building for the future.",
    percentages: {
      needs: 0.60,
      future: 0.20,
      lifestyle: 0.20,
      housing: 0,
      other_needs: 0,
    },
    recommendedFor: "Families with children",
  },
  "PAY_YOURSELF_FIRST": {
    id: "PAY_YOURSELF_FIRST",
    name: "Growth Mode (Pay Yourself First - 30%)",
    description: "For those who want to grow wealth quickly. Prioritizes investments and savings before lifestyle spending.",
    percentages: {
      future: 0.30,
      needs: 0.50, // Calculated as remainder after future
      lifestyle: 0.20, // Calculated as remainder
      housing: 0,
      other_needs: 0,
    },
    recommendedFor: "Fast wealth building",
  },
};

/**
 * Default Category name mappings to rule categories
 * Maps common Category names to their corresponding rule categories
 */
export const DEFAULT_CATEGORY_MAPPINGS: Array<{
  categoryNamePattern: string | RegExp;
  ruleCategory: BudgetRuleCategory;
}> = [
  // Housing
  { categoryNamePattern: /^housing|rent|mortgage|utilities$/i, ruleCategory: "housing" },
  
  // Needs (excluding housing for 40/30/20/10 rule)
  { categoryNamePattern: /^food|groceries|dining|restaurants$/i, ruleCategory: "needs" },
  { categoryNamePattern: /^transportation|vehicle|transit|car$/i, ruleCategory: "needs" },
  { categoryNamePattern: /^health|medical|healthcare|insurance$/i, ruleCategory: "needs" },
  { categoryNamePattern: /^utilities|bills|phone|internet$/i, ruleCategory: "needs" },
  { categoryNamePattern: /^debt|loan|credit|minimum payment$/i, ruleCategory: "needs" },
  
  // Other needs (for 40/30/20/10 rule - needs excluding housing)
  { categoryNamePattern: /^food|groceries$/i, ruleCategory: "other_needs" },
  { categoryNamePattern: /^transportation|vehicle|transit$/i, ruleCategory: "other_needs" },
  { categoryNamePattern: /^health|medical|healthcare$/i, ruleCategory: "other_needs" },
  
  // Lifestyle
  { categoryNamePattern: /^entertainment|recreation|hobbies|streaming$/i, ruleCategory: "lifestyle" },
  { categoryNamePattern: /^travel|vacation|trip$/i, ruleCategory: "lifestyle" },
  { categoryNamePattern: /^shopping|clothing|personal care|beauty$/i, ruleCategory: "lifestyle" },
  { categoryNamePattern: /^dining out|restaurants|takeout$/i, ruleCategory: "lifestyle" },
  
  // Future
  { categoryNamePattern: /^savings|emergency fund|investments|retirement$/i, ruleCategory: "future" },
  { categoryNamePattern: /^investment|portfolio|stocks|bonds$/i, ruleCategory: "future" },
  { categoryNamePattern: /^goals|target|fund$/i, ruleCategory: "future" },
];

/**
 * Map a Category name to a rule category
 */
export function mapCategoryNameToRuleCategory(categoryName: string): BudgetRuleCategory | null {
  for (const mapping of DEFAULT_CATEGORY_MAPPINGS) {
    if (typeof mapping.categoryNamePattern === "string") {
      if (categoryName.toLowerCase().includes(mapping.categoryNamePattern.toLowerCase())) {
        return mapping.ruleCategory;
      }
    } else {
      // RegExp
      if (mapping.categoryNamePattern.test(categoryName)) {
        return mapping.ruleCategory;
      }
    }
  }
  
  // Default to "needs" if no match found
  return "needs";
}

/**
 * Get all available budget rule profiles
 */
export function getAvailableBudgetRules(): BudgetRuleProfile[] {
  return Object.values(BUDGET_RULE_PROFILES);
}

/**
 * Get a budget rule profile by ID
 */
export function getBudgetRuleById(id: string): BudgetRuleProfile | null {
  return BUDGET_RULE_PROFILES[id] || null;
}

