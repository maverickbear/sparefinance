/**
 * Transactions Repository
 * Data access layer for transactions - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseTransaction } from "../../../domain/transactions/transactions.types";
import { logger } from "@/lib/utils/logger";

export interface TransactionRow {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  description: string | null;
  recurring: boolean;
  expenseType: string | null;
  transferToId: string | null;
  transferFromId: string | null;
  createdAt: string;
  updatedAt: string;
  suggestedCategoryId: string | null;
  suggestedSubcategoryId: string | null;
  plaidMetadata: Record<string, unknown> | null;
  userId: string | null;
  householdId: string | null;
  tags: string | null;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: 'income' | 'expense' | 'transfer';
  recurring?: boolean;
  page?: number;
  limit?: number;
}

export class TransactionsRepository {
  /**
   * Find all transactions with filters
   */
  async findAll(
    filters?: TransactionFilters,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    let query = supabase
      .from("Transaction")
      .select("id, date, amount, type, description, categoryId, subcategoryId, accountId, recurring, createdAt, updatedAt, transferToId, transferFromId, tags, suggestedCategoryId, suggestedSubcategoryId, plaidMetadata, expenseType, userId, householdId")
      .order("date", { ascending: false });

    // Apply filters
    if (filters?.startDate) {
      const startDateStr = filters.startDate.toISOString().split('T')[0];
      query = query.gte("date", startDateStr);
    }

    if (filters?.endDate) {
      const endDateStr = filters.endDate.toISOString().split('T')[0];
      query = query.lte("date", endDateStr);
    }

    if (filters?.categoryId) {
      query = query.eq("categoryId", filters.categoryId);
    }

    if (filters?.accountId) {
      query = query.eq("accountId", filters.accountId);
    }

    if (filters?.type) {
      if (filters.type === "transfer") {
        query = query.or("type.eq.transfer,transferToId.not.is.null,transferFromId.not.is.null");
      } else {
        query = query.eq("type", filters.type);
      }
    }

    if (filters?.recurring !== undefined) {
      query = query.eq("recurring", filters.recurring);
    }

    // Pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
      if (filters?.page) {
        const offset = (filters.page - 1) * filters.limit;
        query = query.range(offset, offset + filters.limit - 1);
      }
    }

    const { data: transactions, error } = await query;

    if (error) {
      logger.error("[TransactionsRepository] Error fetching transactions:", error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (transactions || []) as TransactionRow[];
  }

  /**
   * Count transactions with filters
   */
  async count(filters?: TransactionFilters, accessToken?: string, refreshToken?: string): Promise<number> {
    const supabase = await createServerClient(accessToken, refreshToken);

    let query = supabase
      .from("Transaction")
      .select("*", { count: 'exact', head: true });

    // Apply same filters as findAll
    if (filters?.startDate) {
      const startDateStr = filters.startDate.toISOString().split('T')[0];
      query = query.gte("date", startDateStr);
    }

    if (filters?.endDate) {
      const endDateStr = filters.endDate.toISOString().split('T')[0];
      query = query.lte("date", endDateStr);
    }

    if (filters?.categoryId) {
      query = query.eq("categoryId", filters.categoryId);
    }

    if (filters?.accountId) {
      query = query.eq("accountId", filters.accountId);
    }

    if (filters?.type) {
      if (filters.type === "transfer") {
        query = query.or("type.eq.transfer,transferToId.not.is.null,transferFromId.not.is.null");
      } else {
        query = query.eq("type", filters.type);
      }
    }

    if (filters?.recurring !== undefined) {
      query = query.eq("recurring", filters.recurring);
    }

    const { count, error } = await query;

    if (error) {
      logger.error("[TransactionsRepository] Error counting transactions:", error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string, accessToken?: string, refreshToken?: string): Promise<TransactionRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error("[TransactionsRepository] Error fetching transaction:", error);
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }

    return transaction as TransactionRow;
  }

  /**
   * Create a new transaction
   */
  async create(data: {
    id: string;
    date: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    accountId: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
    description?: string | null;
    recurring?: boolean;
    expenseType?: string | null;
    transferToId?: string | null;
    transferFromId?: string | null;
    userId: string;
    householdId: string | null;
    suggestedCategoryId?: string | null;
    suggestedSubcategoryId?: string | null;
    plaidMetadata?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<TransactionRow> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .insert({
        id: data.id,
        date: data.date,
        type: data.type,
        amount: data.amount,
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        subcategoryId: data.subcategoryId ?? null,
        description: data.description ?? null,
        recurring: data.recurring ?? false,
        expenseType: data.expenseType ?? null,
        transferToId: data.transferToId ?? null,
        transferFromId: data.transferFromId ?? null,
        userId: data.userId,
        householdId: data.householdId,
        suggestedCategoryId: data.suggestedCategoryId ?? null,
        suggestedSubcategoryId: data.suggestedSubcategoryId ?? null,
        plaidMetadata: data.plaidMetadata ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[TransactionsRepository] Error creating transaction:", error);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return transaction as TransactionRow;
  }

  /**
   * Update a transaction
   */
  async update(
    id: string,
    data: Partial<{
      date: string;
      type: 'income' | 'expense' | 'transfer';
      amount: number;
      accountId: string;
      categoryId: string | null;
      subcategoryId: string | null;
      description: string | null;
      recurring: boolean;
      expenseType: string | null;
      transferToId: string | null;
      transferFromId: string | null;
      updatedAt: string;
    }>
  ): Promise<TransactionRow> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[TransactionsRepository] Error updating transaction:", error);
      throw new Error(`Failed to update transaction: ${error.message}`);
    }

    return transaction as TransactionRow;
  }

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Transaction")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[TransactionsRepository] Error deleting transaction:", error);
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  }

  /**
   * Delete multiple transactions
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Transaction")
      .delete()
      .in("id", ids);

    if (error) {
      logger.error("[TransactionsRepository] Error deleting transactions:", error);
      throw new Error(`Failed to delete transactions: ${error.message}`);
    }
  }

  /**
   * Get transactions for account balance calculation
   */
  async getTransactionsForBalance(accountId: string, endDate: Date): Promise<Array<{
    accountId: string;
    type: string;
    amount: number;
    date: string;
  }>> {
    const supabase = await createServerClient();

    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select("accountId, type, amount, date")
      .eq("accountId", accountId)
      .lte("date", endDate.toISOString());

    if (error) {
      logger.error("[TransactionsRepository] Error fetching transactions for balance:", error);
      return [];
    }

    return (transactions || []) as Array<{
      accountId: string;
      type: string;
      amount: number;
      date: string;
    }>;
  }

  /**
   * Call SQL function for transfer creation
   */
  async createTransferWithLimit(params: {
    userId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description: string | null;
    descriptionSearch: string | null;
    recurring: boolean;
    maxTransactions: number;
  }): Promise<{ id: string } | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc('create_transfer_with_limit', {
      p_user_id: params.userId,
      p_from_account_id: params.fromAccountId,
      p_to_account_id: params.toAccountId,
      p_amount: params.amount,
      p_date: params.date,
      p_description: params.description,
      p_description_search: params.descriptionSearch,
      p_recurring: params.recurring,
      p_max_transactions: params.maxTransactions,
    });

    if (error) {
      logger.error("[TransactionsRepository] Error creating transfer:", error);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }

    return data as { id: string } | null;
  }

  /**
   * Call SQL function for transaction creation with limit check
   */
  async createTransactionWithLimit(params: {
    userId: string;
    accountId: string;
    amount: number;
    date: string;
    type: string;
    description: string | null;
    descriptionSearch: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    recurring: boolean;
    expenseType: string | null;
    maxTransactions: number;
  }): Promise<{ id: string } | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc('create_transaction_with_limit', {
      p_user_id: params.userId,
      p_account_id: params.accountId,
      p_amount: params.amount,
      p_date: params.date,
      p_type: params.type,
      p_description: params.description,
      p_description_search: params.descriptionSearch,
      p_category_id: params.categoryId,
      p_subcategory_id: params.subcategoryId,
      p_recurring: params.recurring,
      p_expense_type: params.expenseType,
      p_max_transactions: params.maxTransactions,
    });

    if (error) {
      logger.error("[TransactionsRepository] Error creating transaction with limit:", error);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return data as { id: string } | null;
  }
}

