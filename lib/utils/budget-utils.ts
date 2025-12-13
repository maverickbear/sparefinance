/**
 * Budget Utility Functions
 * Frontend utilities for budget calculations (status, percentage)
 * 
 * SIMPLIFIED: Status calculation moved from backend to frontend for flexibility
 */

export interface BudgetStatusConfig {
  warningThreshold?: number; // Default: 80
  overThreshold?: number;    // Default: 100
}

export interface BudgetStatusResult {
  percentage: number;
  status: "ok" | "warning" | "over";
}

/**
 * Calculate budget status and percentage from amount and actual spend
 * 
 * @param amount - Budget amount
 * @param actualSpend - Actual spending
 * @param config - Optional thresholds (default: warning 80%, over 100%)
 * @returns Object with percentage and status
 */
export function calculateBudgetStatus(
  amount: number,
  actualSpend: number,
  config: BudgetStatusConfig = {}
): BudgetStatusResult {
  const percentage = amount > 0 ? (actualSpend / amount) * 100 : 0;
  const warningThreshold = config.warningThreshold ?? 80;
  const overThreshold = config.overThreshold ?? 100;
  
  const status: "ok" | "warning" | "over" = 
    percentage >= overThreshold ? "over" : 
    percentage >= warningThreshold ? "warning" : 
    "ok";
    
  return { percentage, status };
}

/**
 * Get status color class for budget status
 */
export function getBudgetStatusColor(status: "ok" | "warning" | "over"): string {
  if (status === "over") return "bg-destructive";
  if (status === "warning") return "bg-sentiment-warning";
  return "bg-sentiment-positive";
}

/**
 * Get status text color class for budget status
 */
export function getBudgetStatusTextColor(status: "ok" | "warning" | "over"): string {
  if (status === "over") return "text-destructive";
  if (status === "warning") return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

/**
 * Get status label for budget status
 */
export function getBudgetStatusLabel(status: "ok" | "warning" | "over"): string {
  if (status === "over") return "Over Budget";
  if (status === "warning") return "Warning";
  return "On Track";
}
