/**
 * Accounts Mapper
 * Maps between domain entities and infrastructure DTOs
 */

import { BaseAccount, AccountWithBalance } from "../../domain/accounts/accounts.types";
import { AccountRow, AccountOwnerRow } from "@/src/infrastructure/database/repositories/accounts.repository";

export class AccountsMapper {
  /**
   * Map repository row to domain entity
   */
  static toDomain(row: AccountRow): BaseAccount {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      userId: row.user_id,
      creditLimit: row.credit_limit,
      initialBalance: row.initial_balance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dueDayOfMonth: row.due_day_of_month,
      extraCredit: row.extra_credit,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseAccount & { householdId?: string | null }>): Partial<AccountRow> {
    return {
      id: domain.id,
      name: domain.name,
      type: domain.type,
      user_id: domain.userId ?? null,
      household_id: (domain as any).householdId ?? null,
      credit_limit: domain.creditLimit ?? null,
      initial_balance: domain.initialBalance ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
      due_day_of_month: domain.dueDayOfMonth ?? null,
      extra_credit: domain.extraCredit ?? 0,
    };
  }

  /**
   * Map repository rows to domain entities with balance
   */
  static toDomainWithBalance(
    rows: AccountRow[],
    balances: Map<string, number>,
    ownerIdsMap: Map<string, string[]>,
    householdNamesMap: Map<string, string>
  ): AccountWithBalance[] {
    return rows.map(row => {
      const ownerIds = ownerIdsMap.get(row.id) || (row.user_id ? [row.user_id] : []);
      const householdName = ownerIds
        .map(ownerId => householdNamesMap.get(ownerId))
        .filter(Boolean)
        .join(", ") || null;

      return {
        ...this.toDomain(row),
        balance: balances.get(row.id) || 0,
        householdName,
        ownerIds,
      };
    });
  }
}

