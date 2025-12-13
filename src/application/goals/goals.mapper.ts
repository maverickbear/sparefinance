/**
 * Goals Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseGoal, GoalWithCalculations } from "../../domain/goals/goals.types";
import { GoalRow } from "@/src/infrastructure/database/repositories/goals.repository";

export class GoalsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: GoalRow): BaseGoal {
    return {
      id: row.id,
      name: row.name,
      targetAmount: row.target_amount,
      currentBalance: row.current_balance,
      incomePercentage: row.income_percentage,
      priority: row.priority,
      isPaused: row.is_paused,
      isCompleted: row.is_completed,
      completedAt: row.completed_at,
      description: row.description,
      expectedIncome: row.expected_income,
      targetMonths: row.target_months,
      accountId: row.account_id,
      holdingId: row.holding_id,
      isSystemGoal: row.is_system_goal,
      userId: row.user_id,
      householdId: row.household_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseGoal>): Partial<GoalRow> {
    return {
      id: domain.id,
      name: domain.name,
      target_amount: domain.targetAmount,
      current_balance: domain.currentBalance ?? 0,
      income_percentage: domain.incomePercentage ?? 0,
      priority: domain.priority,
      is_paused: domain.isPaused ?? false,
      is_completed: domain.isCompleted ?? false,
      completed_at: domain.completedAt ?? null,
      description: domain.description ?? null,
      expected_income: domain.expectedIncome ?? null,
      target_months: domain.targetMonths ?? null,
      account_id: domain.accountId ?? null,
      holding_id: domain.holdingId ?? null,
      is_system_goal: domain.isSystemGoal ?? false,
      user_id: domain.userId!,
      household_id: domain.householdId ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with calculations
   */
  static toDomainWithCalculations(
    row: GoalRow,
    calculations: {
      monthlyContribution: number;
      monthsToGoal: number | null;
      progressPct: number;
      incomeBasis: number;
    }
  ): GoalWithCalculations {
    return {
      ...this.toDomain(row),
      monthlyContribution: calculations.monthlyContribution,
      monthsToGoal: calculations.monthsToGoal,
      progressPct: calculations.progressPct,
      incomeBasis: calculations.incomeBasis,
    };
  }
}

