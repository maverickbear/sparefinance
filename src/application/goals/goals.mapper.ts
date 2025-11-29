/**
 * Goals Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseGoal, GoalWithCalculations } from "../../domain/goals/goals.types";
import { GoalRow } from "../../infrastructure/database/repositories/goals.repository";

export class GoalsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: GoalRow): BaseGoal {
    return {
      id: row.id,
      name: row.name,
      targetAmount: row.targetAmount,
      currentBalance: row.currentBalance,
      incomePercentage: row.incomePercentage,
      priority: row.priority,
      isPaused: row.isPaused,
      isCompleted: row.isCompleted,
      completedAt: row.completedAt,
      description: row.description,
      expectedIncome: row.expectedIncome,
      targetMonths: row.targetMonths,
      accountId: row.accountId,
      holdingId: row.holdingId,
      isSystemGoal: row.isSystemGoal,
      userId: row.userId,
      householdId: row.householdId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseGoal>): Partial<GoalRow> {
    return {
      id: domain.id,
      name: domain.name,
      targetAmount: domain.targetAmount,
      currentBalance: domain.currentBalance ?? 0,
      incomePercentage: domain.incomePercentage ?? 0,
      priority: domain.priority,
      isPaused: domain.isPaused ?? false,
      isCompleted: domain.isCompleted ?? false,
      completedAt: domain.completedAt ?? null,
      description: domain.description ?? null,
      expectedIncome: domain.expectedIncome ?? null,
      targetMonths: domain.targetMonths ?? null,
      accountId: domain.accountId ?? null,
      holdingId: domain.holdingId ?? null,
      isSystemGoal: domain.isSystemGoal ?? false,
      userId: domain.userId!,
      householdId: domain.householdId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
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

