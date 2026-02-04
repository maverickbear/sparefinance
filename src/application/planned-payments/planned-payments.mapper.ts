/**
 * Planned Payments Mapper
 * Maps between domain entities and infrastructure DTOs
 * 
 * SIMPLIFIED: Uses new Financial Events domain types (with backward compatibility)
 */

import { BaseFinancialEvent } from "../../domain/financial-events/financial-events.types";
import { PlannedPaymentRow } from "@/src/infrastructure/database/repositories/planned-payments.repository";
import { decryptDescription } from "@/src/infrastructure/utils/transaction-encryption";

export class PlannedPaymentsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(
    row: PlannedPaymentRow,
    relations?: {
      account?: { id: string; name: string } | null;
      toAccount?: { id: string; name: string } | null;
      category?: { id: string; name: string } | null;
      subcategory?: { id: string; name: string; logo?: string | null } | null;
      debt?: { id: string; name: string } | null;
    }
  ): BaseFinancialEvent {
    return {
      id: row.id,
      date: new Date(row.date),
      type: row.type,
      amount: Number(row.amount),
      accountId: row.account_id,
      toAccountId: row.to_account_id,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      description: decryptDescription(row.description),
      source: row.source,
      status: row.status,
      linkedTransactionId: row.linked_transaction_id,
      debtId: row.debt_id,
      subscriptionId: row.subscription_id,
      goalId: row.goal_id,
      userId: row.user_id,
      householdId: row.household_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      account: relations?.account || null,
      toAccount: relations?.toAccount || null,
      category: relations?.category || null,
      subcategory: relations?.subcategory || null,
      debt: relations?.debt || null,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseFinancialEvent>): Partial<PlannedPaymentRow> {
    return {
      id: domain.id,
      date: domain.date ? (typeof domain.date === 'string' ? domain.date : domain.date.toISOString().split('T')[0]) : undefined,
      type: domain.type,
      amount: domain.amount,
      account_id: domain.accountId,
      to_account_id: domain.toAccountId ?? null,
      category_id: domain.categoryId ?? null,
      subcategory_id: domain.subcategoryId ?? null,
      source: domain.source,
      status: domain.status,
      linked_transaction_id: domain.linkedTransactionId ?? null,
      debt_id: domain.debtId ?? null,
      subscription_id: domain.subscriptionId ?? null,
      goal_id: domain.goalId ?? null,
      user_id: domain.userId,
      household_id: domain.householdId,
    };
  }
}

