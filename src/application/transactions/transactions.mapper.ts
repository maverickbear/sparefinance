/**
 * Transactions Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseTransaction, TransactionWithRelations } from "../../domain/transactions/transactions.types";
import { TransactionRow } from "@/src/infrastructure/database/repositories/transactions.repository";

export class TransactionsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: TransactionRow): BaseTransaction {
    return {
      id: row.id,
      date: row.date,
      type: row.type,
      amount: row.amount,
      accountId: row.account_id,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      description: row.description,
      descriptionSearch: row.description_search,
      tags: row.tags,
      isRecurring: row.is_recurring,
      expenseType: row.expense_type,
      transferToId: row.transfer_to_id,
      transferFromId: row.transfer_from_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suggestedCategoryId: row.suggested_category_id,
      suggestedSubcategoryId: row.suggested_subcategory_id,
      receiptUrl: row.receipt_url,
      userId: row.user_id,
      householdId: row.household_id,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseTransaction>): Partial<TransactionRow> {
    return {
      id: domain.id,
      date: typeof domain.date === 'string' ? domain.date : domain.date?.toISOString().split('T')[0],
      type: domain.type,
      amount: domain.amount,
      account_id: domain.accountId,
      category_id: domain.categoryId ?? null,
      subcategory_id: domain.subcategoryId ?? null,
      description: domain.description ?? null,
      description_search: domain.descriptionSearch ?? null,
      tags: domain.tags ?? null,
      is_recurring: domain.isRecurring ?? false,
      expense_type: domain.expenseType ?? null,
      transfer_to_id: domain.transferToId ?? null,
      transfer_from_id: domain.transferFromId ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
      suggested_category_id: domain.suggestedCategoryId ?? null,
      suggested_subcategory_id: domain.suggestedSubcategoryId ?? null,
      receipt_url: domain.receiptUrl ?? null,
      user_id: domain.userId ?? null,
      household_id: domain.householdId ?? null,
    };
  }

  /**
   * Map repository row to domain entity with relations
   * Relations are fetched separately and merged
   */
  static toDomainWithRelations(
    row: TransactionRow,
    relations?: {
      account?: { id: string; name: string; type: string; balance?: number } | null;
      category?: { id: string; name: string } | null;
      subcategory?: { id: string; name: string; logo?: string | null } | null;
      suggestedCategory?: { id: string; name: string } | null;
      suggestedSubcategory?: { id: string; name: string; logo?: string | null } | null;
    }
  ): TransactionWithRelations {
    return {
      ...this.toDomain(row),
      account: relations?.account ?? null,
      category: relations?.category ?? null,
      subcategory: relations?.subcategory ?? null,
      suggestedCategory: relations?.suggestedCategory ?? null,
      suggestedSubcategory: relations?.suggestedSubcategory ?? null,
    };
  }
}

