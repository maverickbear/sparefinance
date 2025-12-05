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
      accountId: row.accountId,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      description: row.description,
      isRecurring: row.isRecurring,
      expenseType: row.expenseType,
      transferToId: row.transferToId,
      transferFromId: row.transferFromId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      suggestedCategoryId: row.suggestedCategoryId,
      suggestedSubcategoryId: row.suggestedSubcategoryId,
      plaidMetadata: row.plaidMetadata,
      receiptUrl: row.receiptUrl,
      userId: row.userId,
      householdId: row.householdId,
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
      accountId: domain.accountId,
      categoryId: domain.categoryId ?? null,
      subcategoryId: domain.subcategoryId ?? null,
      description: domain.description ?? null,
      isRecurring: domain.isRecurring ?? false,
      expenseType: domain.expenseType ?? null,
      transferToId: domain.transferToId ?? null,
      transferFromId: domain.transferFromId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      suggestedCategoryId: domain.suggestedCategoryId ?? null,
      suggestedSubcategoryId: domain.suggestedSubcategoryId ?? null,
      plaidMetadata: domain.plaidMetadata ?? null,
      receiptUrl: domain.receiptUrl ?? null,
      userId: domain.userId ?? null,
      householdId: domain.householdId ?? null,
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
      category?: { id: string; name: string; macroId?: string; macro?: { id: string; name: string } | null } | null;
      subcategory?: { id: string; name: string; logo?: string | null } | null;
    }
  ): TransactionWithRelations {
    return {
      ...this.toDomain(row),
      account: relations?.account ?? null,
      category: relations?.category ?? null,
      subcategory: relations?.subcategory ?? null,
    };
  }
}

