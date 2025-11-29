/**
 * Planned Payments Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BasePlannedPayment } from "../../domain/planned-payments/planned-payments.types";
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
    }
  ): BasePlannedPayment {
    return {
      id: row.id,
      date: new Date(row.date),
      type: row.type,
      amount: Number(row.amount),
      accountId: row.accountId,
      toAccountId: row.toAccountId,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      description: decryptDescription(row.description),
      source: row.source,
      status: row.status,
      linkedTransactionId: row.linkedTransactionId,
      debtId: row.debtId,
      subscriptionId: row.subscriptionId,
      userId: row.userId,
      householdId: row.householdId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      account: relations?.account || null,
      toAccount: relations?.toAccount || null,
      category: relations?.category || null,
      subcategory: relations?.subcategory || null,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BasePlannedPayment>): Partial<PlannedPaymentRow> {
    return {
      id: domain.id,
      date: domain.date ? (typeof domain.date === 'string' ? domain.date : domain.date.toISOString().split('T')[0]) : undefined,
      type: domain.type,
      amount: domain.amount,
      accountId: domain.accountId,
      toAccountId: domain.toAccountId ?? null,
      categoryId: domain.categoryId ?? null,
      subcategoryId: domain.subcategoryId ?? null,
      source: domain.source,
      status: domain.status,
      linkedTransactionId: domain.linkedTransactionId ?? null,
      debtId: domain.debtId ?? null,
      subscriptionId: domain.subscriptionId ?? null,
      userId: domain.userId,
      householdId: domain.householdId,
    };
  }
}

