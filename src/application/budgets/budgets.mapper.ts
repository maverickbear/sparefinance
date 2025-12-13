/**
 * Budgets Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseBudget, BudgetWithRelations } from "../../domain/budgets/budgets.types";
import { BudgetRow } from "@/src/infrastructure/database/repositories/budgets.repository";

export class BudgetsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: BudgetRow): BaseBudget {
    return {
      id: row.id,
      period: row.period,
      amount: row.amount,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      userId: row.user_id,
      note: row.note,
      isRecurring: row.is_recurring,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      category_id: domain.categoryId ?? null,
      subcategory_id: domain.subcategoryId ?? null,
      user_id: domain.userId!,
      note: domain.note ?? null,
      is_recurring: domain.isRecurring ?? false,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
    };
  }

  /**
   * Map repository row to domain entity with relations
   */
  static toDomainWithRelations(
    row: BudgetRow,
    relations?: {
      category?: { id: string; name: string; type?: "income" | "expense" } | null;
      subcategory?: { id: string; name: string } | null;
      /** @deprecated Groups have been removed. This field is kept for backward compatibility. */
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
      actualSpend: relations?.actualSpend,
      percentage: relations?.percentage,
      status: relations?.status,
      displayName: relations?.displayName,
    };
  }
}

