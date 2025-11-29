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
      userId: row.userId,
      creditLimit: row.creditLimit,
      initialBalance: row.initialBalance,
      plaidItemId: row.plaidItemId,
      plaidAccountId: row.plaidAccountId,
      isConnected: row.isConnected,
      lastSyncedAt: row.lastSyncedAt,
      syncEnabled: row.syncEnabled,
      plaidMask: row.plaidMask,
      plaidOfficialName: row.plaidOfficialName,
      plaidVerificationStatus: row.plaidVerificationStatus,
      plaidSubtype: row.plaidSubtype,
      currencyCode: row.currencyCode,
      plaidUnofficialCurrencyCode: row.plaidUnofficialCurrencyCode,
      plaidAvailableBalance: row.plaidAvailableBalance,
      plaidPersistentAccountId: row.plaidPersistentAccountId,
      plaidHolderCategory: row.plaidHolderCategory,
      plaidVerificationName: row.plaidVerificationName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dueDayOfMonth: row.dueDayOfMonth,
      extraCredit: row.extraCredit,
    };
  }

  /**
   * Map domain entity to repository row
   */
  static toRepository(domain: Partial<BaseAccount>): Partial<AccountRow> {
    return {
      id: domain.id,
      name: domain.name,
      type: domain.type,
      userId: domain.userId ?? null,
      creditLimit: domain.creditLimit ?? null,
      initialBalance: domain.initialBalance ?? null,
      plaidItemId: domain.plaidItemId ?? null,
      plaidAccountId: domain.plaidAccountId ?? null,
      isConnected: domain.isConnected ?? null,
      lastSyncedAt: domain.lastSyncedAt ?? null,
      syncEnabled: domain.syncEnabled ?? null,
      plaidMask: domain.plaidMask ?? null,
      plaidOfficialName: domain.plaidOfficialName ?? null,
      plaidVerificationStatus: domain.plaidVerificationStatus ?? null,
      plaidSubtype: domain.plaidSubtype ?? null,
      currencyCode: domain.currencyCode ?? null,
      plaidUnofficialCurrencyCode: domain.plaidUnofficialCurrencyCode ?? null,
      plaidAvailableBalance: domain.plaidAvailableBalance ?? null,
      plaidPersistentAccountId: domain.plaidPersistentAccountId ?? null,
      plaidHolderCategory: domain.plaidHolderCategory ?? null,
      plaidVerificationName: domain.plaidVerificationName ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      dueDayOfMonth: domain.dueDayOfMonth ?? null,
      extraCredit: domain.extraCredit ?? 0,
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
      const ownerIds = ownerIdsMap.get(row.id) || (row.userId ? [row.userId] : []);
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

