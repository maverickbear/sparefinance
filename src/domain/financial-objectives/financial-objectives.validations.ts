/**
 * Financial Objectives Validations
 * 
 * SIMPLIFIED: Goals and Debts maintain separate validations for now.
 * This file provides a conceptual grouping and can be extended in the future.
 * 
 * In practice, we use goalSchema and debtSchema separately, but treat them
 * as "financial objectives" in the service layer.
 */

// Re-export goal and debt validations
export { goalSchema } from "../goals/goals.validations";
export { debtSchema } from "../debts/debts.validations";
export type { GoalFormData } from "../goals/goals.validations";
export type { DebtFormData } from "../debts/debts.validations";

/**
 * Financial Objective Form Data
 * Union type for type-safe handling
 */
import type { GoalFormData } from "../goals/goals.validations";
import type { DebtFormData } from "../debts/debts.validations";

export type FinancialObjectiveFormData = GoalFormData | DebtFormData;
