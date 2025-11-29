/**
 * Domain types for goals
 * Pure TypeScript types with no external dependencies
 */

export interface BaseGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  isPaused: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
  description?: string | null;
  expectedIncome?: number | null;
  targetMonths?: number | null;
  accountId?: string | null;
  holdingId?: string | null;
  isSystemGoal?: boolean;
  userId: string;
  householdId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalWithCalculations extends BaseGoal {
  monthlyContribution: number;
  monthsToGoal: number | null;
  progressPct: number;
  incomeBasis: number;
}

// Alias for backward compatibility
export type Goal = BaseGoal;

