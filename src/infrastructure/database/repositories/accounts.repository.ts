/**
 * Accounts Repository
 * Data access layer for accounts - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseAccount } from "../../../domain/accounts/accounts.types";
import { logger } from "@/lib/utils/logger";

export interface AccountRow {
  id: string;
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  userId: string | null;
  creditLimit: number | null;
  initialBalance: number | null;
  plaidItemId: string | null;
  plaidAccountId: string | null;
  isConnected: boolean | null;
  lastSyncedAt: string | null;
  syncEnabled: boolean | null;
  plaidMask: string | null;
  plaidOfficialName: string | null;
  plaidVerificationStatus: string | null;
  plaidSubtype: string | null;
  currencyCode: string | null;
  plaidUnofficialCurrencyCode: string | null;
  plaidAvailableBalance: number | null;
  plaidPersistentAccountId: string | null;
  plaidHolderCategory: 'personal' | 'business' | 'unrecognized' | null;
  plaidVerificationName: string | null;
  createdAt: string;
  updatedAt: string;
  dueDayOfMonth: number | null;
  extraCredit: number;
  householdId: string | null;
}

export interface AccountOwnerRow {
  accountId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export class AccountsRepository {
  /**
   * Find all accounts for a user
   */
  async findAll(
    accessToken?: string,
    refreshToken?: string,
    options?: { selectFields?: string[] }
  ): Promise<AccountRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const selectFields = options?.selectFields || [
      "id", "name", "type", "initialBalance", "isConnected", 
      "createdAt", "updatedAt", "userId", "householdId"
    ];

    const { data: accounts, error } = await supabase
      .from("Account")
      .select(selectFields.join(", "))
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AccountsRepository] Error fetching accounts:", error);
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    return (accounts || []) as unknown as AccountRow[];
  }

  /**
   * Find account by ID
   */
  async findById(id: string, accessToken?: string, refreshToken?: string): Promise<AccountRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: account, error } = await supabase
      .from("Account")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error("[AccountsRepository] Error fetching account:", error);
      throw new Error(`Failed to fetch account: ${error.message}`);
    }

    return account as AccountRow;
  }

  /**
   * Create a new account
   */
  async create(data: {
    id: string;
    name: string;
    type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
    creditLimit?: number | null;
    initialBalance?: number | null;
    dueDayOfMonth?: number | null;
    currencyCode?: string | null;
    userId: string;
    householdId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<AccountRow> {
    const supabase = await createServerClient();

    const { data: account, error } = await supabase
      .from("Account")
      .insert({
        id: data.id,
        name: data.name,
        type: data.type,
        creditLimit: data.creditLimit ?? null,
        initialBalance: data.initialBalance ?? null,
        dueDayOfMonth: data.dueDayOfMonth ?? null,
        currencyCode: data.currencyCode || 'USD',
        userId: data.userId,
        householdId: data.householdId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[AccountsRepository] Error creating account:", error);
      throw new Error(`Failed to create account: ${error.message}`);
    }

    return account as AccountRow;
  }

  /**
   * Update an account
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
      creditLimit: number | null;
      initialBalance: number | null;
      dueDayOfMonth: number | null;
      currencyCode: string | null;
      updatedAt: string;
    }>
  ): Promise<AccountRow> {
    const supabase = await createServerClient();

    const { data: account, error } = await supabase
      .from("Account")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[AccountsRepository] Error updating account:", error);
      throw new Error(`Failed to update account: ${error.message}`);
    }

    return account as AccountRow;
  }

  /**
   * Delete an account
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Account")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[AccountsRepository] Error deleting account:", error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Get account owners
   */
  async getAccountOwners(accountId: string): Promise<AccountOwnerRow[]> {
    const supabase = await createServerClient();

    const { data: owners, error } = await supabase
      .from("AccountOwner")
      .select("accountId, ownerId, createdAt, updatedAt")
      .eq("accountId", accountId);

    if (error) {
      logger.error("[AccountsRepository] Error fetching account owners:", error);
      throw new Error(`Failed to fetch account owners: ${error.message}`);
    }

    return (owners || []) as AccountOwnerRow[];
  }

  /**
   * Set account owners (replaces existing)
   */
  async setAccountOwners(accountId: string, ownerIds: string[], now: string): Promise<void> {
    const supabase = await createServerClient();

    // Delete existing owners
    const { error: deleteError } = await supabase
      .from("AccountOwner")
      .delete()
      .eq("accountId", accountId);

    if (deleteError) {
      logger.error("[AccountsRepository] Error deleting account owners:", deleteError);
      throw new Error(`Failed to delete account owners: ${deleteError.message}`);
    }

    // Insert new owners
    if (ownerIds.length > 0) {
      const accountOwners = ownerIds.map(ownerId => ({
        accountId,
        ownerId,
        createdAt: now,
        updatedAt: now,
      }));

      const { error: insertError } = await supabase
        .from("AccountOwner")
        .insert(accountOwners);

      if (insertError) {
        logger.error("[AccountsRepository] Error creating account owners:", insertError);
        throw new Error(`Failed to create account owners: ${insertError.message}`);
      }
    }
  }

  /**
   * Get transactions for account balance calculation
   */
  async getTransactionsForBalance(accountIds: string[], endDate: Date): Promise<Array<{
    accountId: string;
    type: string;
    amount: unknown;
    date: string;
  }>> {
    const supabase = await createServerClient();

    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select("accountId, type, amount, date")
      .in("accountId", accountIds)
      .lte("date", endDate.toISOString());

    if (error) {
      logger.error("[AccountsRepository] Error fetching transactions:", error);
      return [];
    }

    return (transactions || []) as Array<{
      accountId: string;
      type: string;
      amount: unknown;
      date: string;
    }>;
  }

  /**
   * Check if account has transactions
   */
  async hasTransactions(accountId: string): Promise<boolean> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("Transaction")
      .select("id")
      .eq("accountId", accountId)
      .limit(1);

    if (error) {
      logger.error("[AccountsRepository] Error checking transactions:", error);
      return true; // Assume has transactions to be safe
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Transfer transactions from one account to another
   */
  async transferTransactions(fromAccountId: string, toAccountId: string): Promise<number> {
    const supabase = await createServerClient();

    // Get count before transfer
    const { data: transactions } = await supabase
      .from("Transaction")
      .select("id")
      .eq("accountId", fromAccountId);

    const count = transactions?.length || 0;

    if (count === 0) {
      return 0;
    }

    // Update transactions
    const { error: updateError } = await supabase
      .from("Transaction")
      .update({ accountId: toAccountId })
      .eq("accountId", fromAccountId);

    if (updateError) {
      logger.error("[AccountsRepository] Error transferring transactions:", updateError);
      throw new Error(`Failed to transfer transactions: ${updateError.message}`);
    }

    // Update transfer references
    await supabase
      .from("Transaction")
      .update({ transferToId: toAccountId })
      .eq("transferToId", fromAccountId);

    return count;
  }
}

