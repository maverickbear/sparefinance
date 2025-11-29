/**
 * Budgets Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseBudget, BudgetWithRelations } from "../../domain/budgets/budgets.types";
import { BudgetRow } from "../../infrastructure/database/repositories/budgets.repository";

export class BudgetsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: BudgetRow): BaseBudget {
    return {
      id: row.id,
      period: row.period,
      amount: row.amount,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      groupId: row.groupId,
      userId: row.userId,
      note: row.note,
      isRecurring: row.isRecurring,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseBudget>): Partial<BudgetRow> {
    return {
      id: domain.id,
      period: domain.period,
      amount: domain.amount,
      categoryId: domain.categoryId ?? null,
      subcategoryId: domain.subcategoryId ?? null,
      groupId: domain.groupId ?? null,
      userId: domain.userId!,
      note: domain.note ?? null,
      isRecurring: domain.isRecurring ?? false,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with relations
   */
  static toDomainWithRelations(
    row: BudgetRow,
    relations?: {
      category?: { id: string; name: string; groupId?: string; group?: { id: string; name: string } | null } | null;
      subcategory?: { id: string; name: string } | null;
      group?: { id: string; name: string } | null;
      actualSpend?: number;
      percentage?: number;
      status?: "ok" | "warning" | "over";
      displayName?: string;
    }
  ): BudgetWithRelations {
    return {
      ...this.toDomain(row),
      category: relations?.category ?? null,
      subcategory: relations?.subcategory ?? null,
      group: relations?.group ?? null,
      actualSpend: relations?.actualSpend,
      percentage: relations?.percentage,
      status: relations?.status,
      displayName: relations?.displayName,
    };
  }
}

