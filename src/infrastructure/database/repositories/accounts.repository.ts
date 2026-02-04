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
  currency_code: string | null;
  created_at: string;
  updated_at: string;
  due_day_of_month: number | null;
  extra_credit: number;
  household_id: string | null;
  deleted_at: string | null;
  is_default: boolean;
}

export interface AccountOwnerRow {
  account_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
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
      "created_at", "updated_at", "user_id", "household_id", "is_default"
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

    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
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

    return account as AccountRow;
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

    // 1. Upsert desired owners (handles both new and re-activating soft-deleted)
    if (ownerIds.length > 0) {
      const accountOwners = ownerIds.map(ownerId => ({
        account_id: accountId,
        owner_id: ownerId,
        created_at: now,
        updated_at: now,
        deleted_at: null, // Ensure they are active
      }));

      const { error: upsertError } = await supabase
        .from("account_owners")
        .upsert(accountOwners, {
          onConflict: 'account_id,owner_id',
          ignoreDuplicates: false, // Update existing records
        });

      if (upsertError) {
        logger.error("[AccountsRepository] Error upserting account owners:", upsertError);
        throw new Error(`Failed to update account owners: ${upsertError.message}`);
      }
    }

    // 2. Soft-delete owners that are NOT in the new list
    // We can't use NOT IN easily with Supabase builder in one go for a delete, 
    // but we can update where account_id matches and owner_id is NOT in the list.
    
    let query = supabase
      .from("account_owners")
      .update({ deleted_at: now, updated_at: now })
      .eq("account_id", accountId)
      .is("deleted_at", null); // Only touch currently active ones

    if (ownerIds.length > 0) {
        // filter out the ones we just upserted/kept
        query = query.not("owner_id", "in", `(${ownerIds.join(',')})`);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      logger.error("[AccountsRepository] Error deleting removed account owners:", deleteError);
      throw new Error(`Failed to remove old account owners: ${deleteError.message}`);
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
  /**
   * Set default account for a user
   * This unsets the default flag for all other accounts associated with the user/household context
   * and sets it to true for the specified account.
   */
  async setDefaultAccount(accountId: string, userId: string): Promise<void> {
    const supabase = await createServerClient();
    
    // First, verify the account belongs to the user or their household (implicitly checked by verifying ownership in service)
    // We'll perform this update in two steps or a transaction if possible.
    // Since we don't have explicit transaction support here in the client easily exposed,
    // we'll unset all first then set the one.

    // 1. Unset is_default for all accounts owned by this user
    // Ideally this should be scoped to household if accounts are shared, but for now user_id seems to be the owner
    // Let's look at how accounts are queried. 
    // Accounts have user_id and ownerIds (via account_owners).
    // If we want a "User's default account", it should be relative to the user.
    // However, the column is on the `accounts` table. This implies an account is globally default?
    // Or default for the `user_id` on the account?
    // If multiple people own the account, can it be default for one but not another?
    // The current schema adds `is_default` to `accounts`, so it's a property of the account itself.
    // This means if I share an account, and I mark it default, it is default for everyone.
    // This is acceptable for a "Household Finance" app where accounts are shared.

    // Unset all is_default for this user's accounts (or all accounts this user has access to?)
    // To be safe and simple: Unset for all accounts where this user is an owner.
    
    // Get all accounts this user owns
    // Actually, simpler: Update all accounts where user_id = userId OR where id IN (select account_id from account_owners where owner_id = userId)
    // But that's a complex query for Supabase client.
    
    // Let's assume the service handles the "scope" logic or we just unset for all account IDs that the service passes?
    // No, repository should handle data.
    
    // Let's try: Update accounts set is_default = false where is_default = true (filtered by RLS?)
    // If RLS is set up correctly, `supabase.from('accounts').update...` will only affect rows the user can seeing/updating.
    
    const { error: unsetError } = await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("is_default", true); // Optimize: only update those that are true
      
    if (unsetError) {
      logger.error("[AccountsRepository] Error unsetting default account:", unsetError);
      throw new Error(`Failed to unset default accounts: ${unsetError.message}`);
    }

    // 2. Set is_default = true for the target account
    const { error: setError } = await supabase
      .from("accounts")
      .update({ is_default: true })
      .eq("id", accountId);

    if (setError) {
      logger.error("[AccountsRepository] Error setting default account:", setError);
      throw new Error(`Failed to set default account: ${setError.message}`);
    }
  }
}

