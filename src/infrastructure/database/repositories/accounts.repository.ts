/**
 * Accounts Repository
 * Data access layer for accounts - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/lib/utils/logger";
import { IAccountsRepository } from "./interfaces/accounts.repository.interface";

export interface AccountRow {
  id: string;
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  user_id: string | null;
  credit_limit: number | null;
  initial_balance: number | null;
  plaid_item_id: string | null;
  plaid_account_id: string | null;
  is_connected: boolean | null;
  last_synced_at: string | null;
  sync_enabled: boolean | null;
  plaid_mask: string | null;
  plaid_official_name: string | null;
  plaid_verification_status: string | null;
  plaid_subtype: string | null;
  currency_code: string | null;
  plaid_unofficial_currency_code: string | null;
  plaid_available_balance: number | null;
  plaid_persistent_account_id: string | null;
  plaid_holder_category: 'personal' | 'business' | 'unrecognized' | null;
  plaid_verification_name: string | null;
  created_at: string;
  updated_at: string;
  due_day_of_month: number | null;
  extra_credit: number;
  household_id: string | null;
  deleted_at: string | null;
}

export interface AccountOwnerRow {
  account_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Type for Supabase response when joining accounts with account_integrations
 * Supabase returns the join as account_integrations (snake_case) but we access it as accountIntegrations
 */
interface AccountWithIntegrationsResponse extends Omit<AccountRow, 'account_integrations'> {
  account_integrations: Array<{
    id: string;
    account_id: string;
    plaid_item_id: string | null;
    plaid_account_id: string | null;
    plaid_mask: string | null;
    plaid_official_name: string | null;
    plaid_subtype: string | null;
    plaid_verification_status: string | null;
    plaid_verification_name: string | null;
    plaid_available_balance: number | null;
    plaid_persistent_account_id: string | null;
    plaid_holder_category: string | null;
    plaid_unofficial_currency_code: string | null;
    is_connected: boolean | null;
    sync_enabled: boolean | null;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export class AccountsRepository implements IAccountsRepository {
  /**
   * Find all accounts for a user
   */
  async findAll(
    accessToken?: string,
    refreshToken?: string,
    options?: { selectFields?: string[] }
  ): Promise<AccountRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Log as debug in development, but don't treat as error
      // This can happen in cached functions when tokens aren't available
      const errorMessage = authError?.message || "Auth session missing!";
      if (process.env.NODE_ENV === 'development') {
        logger.debug("[AccountsRepository] User not authenticated:", errorMessage);
      }
      return [];
    }
    
    const selectFields = options?.selectFields || [
      "id", "name", "type", "initial_balance", 
      "created_at", "updated_at", "user_id", "household_id"
    ];

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select(selectFields.join(", ") + ", deleted_at")
      .is("deleted_at", null) // Exclude soft-deleted records
      .order("name", { ascending: true });

    if (error) {
      logger.error("[AccountsRepository] Error fetching accounts:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId: user.id,
      });
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    return (accounts || []) as unknown as AccountRow[];
  }

  /**
   * Find account by ID
   */
  async findById(id: string, accessToken?: string, refreshToken?: string): Promise<AccountRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Fetch account with accountIntegrations join for Plaid data
    const { data: account, error } = await supabase
      .from("accounts")
      .select(`
        *,
        account_integrations:account_integrations(*)
      `)
      .eq("id", id)
      .is("deleted_at", null) // Exclude soft-deleted records
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error("[AccountsRepository] Error fetching account:", error);
      throw new Error(`Failed to fetch account: ${error.message}`);
    }

    // Merge account_integrations data into account
    // Supabase returns the join as account_integrations (snake_case)
    const accountData = account as unknown as AccountWithIntegrationsResponse;
    if (accountData.account_integrations && accountData.account_integrations.length > 0) {
      const integration = accountData.account_integrations[0];
      // Merge integration fields into account, excluding the nested array
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { account_integrations: _, ...accountWithoutIntegrations } = accountData;
      return {
        ...accountWithoutIntegrations,
        ...integration,
      } as AccountRow;
    }
    // If no integration, return account without the nested property
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { account_integrations: _, ...accountWithoutIntegrations } = accountData;
    return accountWithoutIntegrations as AccountRow;
  }

  /**
   * Find multiple accounts by IDs
   */
  async findByIds(ids: string[], accessToken?: string, refreshToken?: string): Promise<AccountRow[]> {
    if (ids.length === 0) {
      return [];
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, name, type")
      .in("id", ids)
      .is("deleted_at", null); // Exclude soft-deleted records

    if (error) {
      logger.error("[AccountsRepository] Error fetching accounts by IDs:", error);
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    return (accounts || []) as AccountRow[];
  }


  /**
   * Create a new account
   * Receives camelCase parameters and maps to snake_case for database
   */
  async create(data: {
    id: string;
    name: string;
    type: AccountRow['type'];
    userId: string;
    creditLimit?: number | null;
    initialBalance?: number | null;
    dueDayOfMonth?: number | null;
    currencyCode?: string | null;
    householdId?: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<AccountRow> {
    const supabase = await createServerClient();

    // Map camelCase to snake_case for database
    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        id: data.id,
        name: data.name,
        type: data.type,
        credit_limit: data.creditLimit ?? null,
        initial_balance: data.initialBalance ?? null,
        due_day_of_month: data.dueDayOfMonth ?? null,
        currency_code: data.currencyCode || 'USD',
        user_id: data.userId,
        household_id: data.householdId ?? null,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
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

    // Map camelCase to snake_case for database
    const updateData: Partial<{
      name: string;
      type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
      credit_limit: number | null;
      initial_balance: number | null;
      due_day_of_month: number | null;
      currency_code: string | null;
      updated_at: string;
    }> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.creditLimit !== undefined) updateData.credit_limit = data.creditLimit;
    if (data.initialBalance !== undefined) updateData.initial_balance = data.initialBalance;
    if (data.dueDayOfMonth !== undefined) updateData.due_day_of_month = data.dueDayOfMonth;
    if (data.currencyCode !== undefined) updateData.currency_code = data.currencyCode;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: account, error } = await supabase
      .from("accounts")
      .update(updateData)
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
   * Soft delete an account
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("accounts")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null); // Only soft-delete if not already deleted

    if (error) {
      logger.error("[AccountsRepository] Error soft-deleting account:", error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Get account owners
   */
  async getAccountOwners(
    accountId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AccountOwnerRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: owners, error } = await supabase
      .from("account_owners")
      .select("account_id, owner_id, created_at, updated_at")
      .eq("account_id", accountId)
      .is("deleted_at", null); // Exclude soft-deleted records

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

    // Soft delete existing owners
    const { error: deleteError } = await supabase
      .from("account_owners")
      .update({ deleted_at: now, updated_at: now })
      .eq("account_id", accountId)
      .is("deleted_at", null);

    if (deleteError) {
      logger.error("[AccountsRepository] Error deleting account owners:", deleteError);
      throw new Error(`Failed to delete account owners: ${deleteError.message}`);
    }

    // Insert new owners
    if (ownerIds.length > 0) {
      const accountOwners = ownerIds.map(ownerId => ({
        account_id: accountId,
        owner_id: ownerId,
        created_at: now,
        updated_at: now,
      }));

      const { error: insertError } = await supabase
        .from("account_owners")
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
  async getTransactionsForBalance(
    accountIds: string[],
    endDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{
    accountId: string;
    type: string;
    amount: unknown;
    date: string;
  }>> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("account_id, type, amount, date")
      .in("account_id", accountIds)
      .lte("date", endDate.toISOString())
      .is("deleted_at", null); // Exclude soft-deleted records

    if (error) {
      logger.error("[AccountsRepository] Error fetching transactions:", error);
      return [];
    }

    return (transactions || []).map(tx => ({
      accountId: tx.account_id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
    }));
  }

  /**
   * Check if account has transactions
   */
  async hasTransactions(accountId: string): Promise<boolean> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("account_id", accountId)
      .is("deleted_at", null) // Exclude soft-deleted records
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
      .from("transactions")
      .select("id")
      .eq("account_id", fromAccountId)
      .is("deleted_at", null); // Exclude soft-deleted records

    const count = transactions?.length || 0;

    if (count === 0) {
      return 0;
    }

    // Update transactions
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ account_id: toAccountId })
      .eq("account_id", fromAccountId)
      .is("deleted_at", null); // Only update non-deleted transactions

    if (updateError) {
      logger.error("[AccountsRepository] Error transferring transactions:", updateError);
      throw new Error(`Failed to transfer transactions: ${updateError.message}`);
    }

    // Update transfer references
    await supabase
      .from("transactions")
      .update({ transfer_to_id: toAccountId })
      .eq("transfer_to_id", fromAccountId)
      .is("deleted_at", null); // Only update non-deleted transactions

    return count;
  }

  /**
   * Get user names by IDs
   */
  async getUserNamesByIds(
    userIds: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ id: string; name: string | null }>> {
    if (userIds.length === 0) {
      return [];
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: users, error } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    if (error) {
      logger.error("[AccountsRepository] Error fetching user names:", error);
      return [];
    }

    return (users || []) as Array<{ id: string; name: string | null }>;
  }
}

