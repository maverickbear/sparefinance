/**
 * Domain types for financial objectives
 * Pure TypeScript types with no external dependencies
 * 
 * SIMPLIFIED: Unifies Goals and Debts into Financial Objectives
 * This better reflects that both are financial objectives (savings goals vs debt payoff goals)
 */

import { BaseGoal, GoalWithCalculations } from "../goals/goals.types";
import { BaseDebt, DebtWithCalculations } from "../debts/debts.types";

export type FinancialObjectiveType = "goal" | "debt";

/**
 * Base Financial Objective
 * Union type that represents either a Goal or a Debt
 * 
 * SIMPLIFIED: This is a conceptual unification. In practice, we maintain
 * separate types (BaseGoal, BaseDebt) for type safety, but treat them
 * as "financial objectives" in the service layer.
 */
export type BaseFinancialObjective = BaseGoal | BaseDebt;

/**
 * Financial Objective with Calculations
 * Union type for objectives with calculated fields
 */
export type FinancialObjectiveWithCalculations = GoalWithCalculations | DebtWithCalculations;

/**
 * Helper type guards
 */
export function isGoal(objective: BaseFinancialObjective): objective is BaseGoal {
  // Goals have targetAmount, debts don't
  return "targetAmount" in objective;
}

export function isDebt(objective: BaseFinancialObjective): objective is BaseDebt {
  // Debts have loanType, goals don't
  return "loanType" in objective;
}

// Backward compatibility: export old names
export type { BaseGoal, GoalWithCalculations } from "../goals/goals.types";
export type { BaseDebt, DebtWithCalculations } from "../debts/debts.types";
