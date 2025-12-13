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
      plaidItemId: row.plaid_item_id,
      plaidAccountId: row.plaid_account_id,
      isConnected: row.is_connected,
      lastSyncedAt: row.last_synced_at,
      syncEnabled: row.sync_enabled,
      plaidMask: row.plaid_mask,
      plaidOfficialName: row.plaid_official_name,
      plaidVerificationStatus: row.plaid_verification_status,
      plaidSubtype: row.plaid_subtype,
      currencyCode: row.currency_code,
      plaidUnofficialCurrencyCode: row.plaid_unofficial_currency_code,
      plaidAvailableBalance: row.plaid_available_balance,
      plaidPersistentAccountId: row.plaid_persistent_account_id,
      plaidHolderCategory: row.plaid_holder_category as "personal" | "business" | "unrecognized" | null | undefined,
      plaidVerificationName: row.plaid_verification_name,
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
      plaid_item_id: domain.plaidItemId ?? null,
      plaid_account_id: domain.plaidAccountId ?? null,
      is_connected: domain.isConnected ?? null,
      last_synced_at: domain.lastSyncedAt ?? null,
      sync_enabled: domain.syncEnabled ?? null,
      plaid_mask: domain.plaidMask ?? null,
      plaid_official_name: domain.plaidOfficialName ?? null,
      plaid_verification_status: domain.plaidVerificationStatus ?? null,
      plaid_subtype: domain.plaidSubtype ?? null,
      currency_code: domain.currencyCode ?? null,
      plaid_unofficial_currency_code: domain.plaidUnofficialCurrencyCode ?? null,
      plaid_available_balance: domain.plaidAvailableBalance ?? null,
      plaid_persistent_account_id: domain.plaidPersistentAccountId ?? null,
      plaid_holder_category: (domain.plaidHolderCategory as "personal" | "business" | "unrecognized" | null | undefined) ?? null,
      plaid_verification_name: domain.plaidVerificationName ?? null,
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

