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
  isRecurring: boolean;
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
  receiptUrl: string | null;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: 'income' | 'expense' | 'transfer';
    isRecurring?: boolean;
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
      .select("id, date, amount, type, description, categoryId, subcategoryId, accountId, isRecurring, createdAt, updatedAt, transferToId, transferFromId, tags, suggestedCategoryId, suggestedSubcategoryId, expenseType, userId, householdId, receiptUrl")
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

    if (filters?.isRecurring !== undefined) {
      query = query.eq("isRecurring", filters.isRecurring);
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

    if (filters?.isRecurring !== undefined) {
      query = query.eq("isRecurring", filters.isRecurring);
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
   * Find transactions by IDs with account information
   */
  async findByIds(
    ids: string[],
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<TransactionRow & { account?: { id: string; name: string } | null }>> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select(`
        id,
        date,
        amount,
        description,
        accountId,
        account:Account(id, name)
      `)
      .in("id", ids)
      .eq("userId", userId)
      .order("date", { ascending: false });

    if (error) {
      logger.error("[TransactionsRepository] Error finding transactions by IDs:", error);
      throw new Error(`Failed to find transactions: ${error.message}`);
    }

    return (transactions || []) as unknown as Array<TransactionRow & { account?: { id: string; name: string } | null }>;
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
    isRecurring?: boolean;
    expenseType?: string | null;
    transferToId?: string | null;
    transferFromId?: string | null;
    userId: string;
    householdId: string | null;
    suggestedCategoryId?: string | null;
    suggestedSubcategoryId?: string | null;
    plaidMetadata?: Record<string, unknown> | null;
    receiptUrl?: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<TransactionRow> {
    const supabase = await createServerClient();

    // Filter out plaidMetadata if the column doesn't exist in the database
    // This prevents errors when the column is not in the schema
    const { plaidMetadata, ...insertData } = data;

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .insert({
        id: insertData.id,
        date: insertData.date,
        type: insertData.type,
        amount: insertData.amount,
        accountId: insertData.accountId,
        categoryId: insertData.categoryId ?? null,
        subcategoryId: insertData.subcategoryId ?? null,
        description: insertData.description ?? null,
        isRecurring: insertData.isRecurring ?? false,
        expenseType: insertData.expenseType ?? null,
        transferToId: insertData.transferToId ?? null,
        transferFromId: insertData.transferFromId ?? null,
        userId: insertData.userId,
        householdId: insertData.householdId,
        suggestedCategoryId: insertData.suggestedCategoryId ?? null,
        suggestedSubcategoryId: insertData.suggestedSubcategoryId ?? null,
        // plaidMetadata column doesn't exist in database, so we skip it
        receiptUrl: insertData.receiptUrl ?? null,
        createdAt: insertData.createdAt,
        updatedAt: insertData.updatedAt,
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
      isRecurring: boolean;
      expenseType: string | null;
      transferToId: string | null;
      transferFromId: string | null;
      updatedAt: string;
      plaidMetadata: Record<string, unknown> | null;
      receiptUrl: string | null;
    }>
  ): Promise<TransactionRow> {
    const supabase = await createServerClient();

    // Filter out plaidMetadata if the column doesn't exist in the database
    // This prevents errors when the column is not in the schema
    const { plaidMetadata, ...updateData } = data;
    
    const { data: transaction, error } = await supabase
      .from("Transaction")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    
    // Note: plaidMetadata is intentionally excluded from updates
    // as the column doesn't exist in the database schema

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
    isRecurring: boolean;
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
      p_is_recurring: params.isRecurring,
      p_max_transactions: params.maxTransactions,
    });

    if (error) {
      logger.error("[TransactionsRepository] Error creating transfer:", error);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }

    // The SQL function returns { outgoing_id, incoming_id, new_count } as JSONB
    // Supabase RPC should automatically parse JSONB, but handle various formats
    
    // Handle null or undefined
    if (!data) {
      logger.error("[TransactionsRepository] Null response from create_transfer_with_limit:", {
        params: {
          userId: params.userId,
          fromAccountId: params.fromAccountId,
          toAccountId: params.toAccountId,
        },
      });
      return null;
    }

    // Handle string (shouldn't happen with JSONB, but be safe)
    let parsedData: any = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        logger.error("[TransactionsRepository] Failed to parse string response:", { data, parseError });
        return null;
      }
    }

    // Handle array (Supabase might wrap single results)
    if (Array.isArray(parsedData)) {
      if (parsedData.length === 0) {
        logger.error("[TransactionsRepository] Empty array response from create_transfer_with_limit");
        return null;
      }
      parsedData = parsedData[0];
    }

    // Extract outgoing_id
    if (parsedData && typeof parsedData === 'object') {
      // Try different possible property names
      const outgoingId = parsedData.outgoing_id || parsedData.outgoingId || parsedData.id;
      
      if (outgoingId && typeof outgoingId === 'string') {
        return { id: outgoingId };
      }
    }

    // Log unexpected format
    logger.error("[TransactionsRepository] Unexpected response format from create_transfer_with_limit:", {
      originalData: data,
      parsedData,
      dataType: typeof data,
      isArray: Array.isArray(data),
      keys: parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : null,
      params: {
        userId: params.userId,
        fromAccountId: params.fromAccountId,
        toAccountId: params.toAccountId,
      },
    });
    return null;
  }

  /**
   * Call SQL function for transaction creation with limit check
   */
  async createTransactionWithLimit(params: {
    id: string;
    userId: string;
    accountId: string;
    amount: number;
    date: string;
    type: string;
    description: string | null;
    descriptionSearch: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    isRecurring: boolean;
    expenseType: string | null;
    maxTransactions: number;
    createdAt: string;
    updatedAt: string;
  }): Promise<{ id: string } | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc('create_transaction_with_limit', {
      p_id: params.id,
      p_user_id: params.userId,
      p_account_id: params.accountId,
      p_amount: params.amount,
      p_date: params.date,
      p_type: params.type,
      p_description: params.description,
      p_description_search: params.descriptionSearch,
      p_category_id: params.categoryId,
      p_subcategory_id: params.subcategoryId,
      p_is_recurring: params.isRecurring,
      p_expense_type: params.expenseType,
      p_max_transactions: params.maxTransactions,
      p_created_at: params.createdAt,
      p_updated_at: params.updatedAt,
    });

    if (error) {
      logger.error("[TransactionsRepository] Error creating transaction with limit:", error);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    // The SQL function returns { transaction_id, new_count } as JSONB
    // Supabase RPC should automatically parse JSONB, but handle various formats
    
    // Handle null or undefined
    if (!data) {
      logger.error("[TransactionsRepository] Null response from create_transaction_with_limit:", {
        params: {
          id: params.id,
          userId: params.userId,
          accountId: params.accountId,
          type: params.type,
        },
      });
      return null;
    }

    // Handle string (shouldn't happen with JSONB, but be safe)
    let parsedData: any = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        logger.error("[TransactionsRepository] Failed to parse string response:", { data, parseError });
        return null;
      }
    }

    // Handle array (Supabase might wrap single results)
    if (Array.isArray(parsedData)) {
      if (parsedData.length === 0) {
        logger.error("[TransactionsRepository] Empty array response from create_transaction_with_limit");
        return null;
      }
      parsedData = parsedData[0];
    }

    // Extract transaction_id
    if (parsedData && typeof parsedData === 'object') {
      // Try different possible property names
      const transactionId = parsedData.transaction_id || parsedData.transactionId || parsedData.id;
      
      if (transactionId && typeof transactionId === 'string') {
        return { id: transactionId };
      }
    }

    // Log unexpected format
    logger.error("[TransactionsRepository] Unexpected response format from create_transaction_with_limit:", {
      originalData: data,
      parsedData,
      dataType: typeof data,
      isArray: Array.isArray(data),
      keys: parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : null,
      params: {
        id: params.id,
        userId: params.userId,
        accountId: params.accountId,
        type: params.type,
      },
    });
    return null;
  }

  /**
   * Find transaction by ID with suggestion fields
   */
  async findByIdWithSuggestions(id: string): Promise<TransactionRow | null> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .select("id, suggestedCategoryId, suggestedSubcategoryId, userId")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[TransactionsRepository] Error fetching transaction:", error);
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }

    return transaction as TransactionRow;
  }

  /**
   * Find uncategorized transactions for suggestions
   */
  async findUncategorizedForSuggestions(
    userId: string,
    limit: number = 100
  ): Promise<Array<{
    id: string;
    description: string | null;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    userId: string | null;
  }>> {
    const supabase = await createServerClient();

    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select("id, description, amount, type, userId")
      .eq("userId", userId)
      .is("categoryId", null)
      .is("suggestedCategoryId", null)
      .not("description", "is", null)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("[TransactionsRepository] Error fetching uncategorized transactions:", error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (transactions || []) as Array<{
      id: string;
      description: string | null;
      amount: number;
      type: 'income' | 'expense' | 'transfer';
      userId: string | null;
    }>;
  }

  /**
   * Update suggestion fields
   */
  async updateSuggestions(
    id: string,
    data: {
      suggestedCategoryId?: string | null;
      suggestedSubcategoryId?: string | null;
    }
  ): Promise<TransactionRow> {
    const supabase = await createServerClient();

    const { data: transaction, error } = await supabase
      .from("Transaction")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[TransactionsRepository] Error updating suggestions:", error);
      throw new Error(`Failed to update suggestions: ${error.message}`);
    }

    return transaction as TransactionRow;
  }

  /**
   * Clear suggestion fields
   */
  async clearSuggestions(id: string): Promise<TransactionRow> {
    return this.updateSuggestions(id, {
      suggestedCategoryId: null,
      suggestedSubcategoryId: null,
    });
  }

  /**
   * Get aggregated monthly transaction data for charts
   * Returns income and expenses grouped by month - much faster than loading all transactions
   */
  async findMonthlyAggregates(
    startDate: Date,
    endDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ month: string; income: number; expenses: number }>> {
    const supabase = await createServerClient(accessToken, refreshToken);
    const userId = await this.getCurrentUserId(accessToken, refreshToken);
    
    if (!userId) {
      return [];
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Use query-based aggregation (fallback if RPC doesn't exist)
    return await this.aggregateMonthlyDataWithQuery(supabase, userId, startDateStr, endDateStr);
  }

  /**
   * Aggregate monthly data using Supabase query
   * This loads transactions and aggregates them in memory (less efficient but works)
   */
  private async aggregateMonthlyDataWithQuery(
    supabase: any,
    userId: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<Array<{ month: string; income: number; expenses: number }>> {
    // Load transactions for the date range (only date, amount, type - minimal data)
    const { data: transactions, error } = await supabase
      .from("Transaction")
      .select("date, amount, type")
      .eq("userId", userId)
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .neq("type", "transfer") // Exclude transfers
      .order("date", { ascending: true });

    if (error) {
      logger.error("[TransactionsRepository] Error loading transactions for aggregation:", error);
      return [];
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group by month and calculate totals
    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    transactions.forEach((tx: any) => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { income: 0, expenses: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      const amount = Number(tx.amount || 0);

      if (tx.type === 'income' && amount > 0) {
        monthData.income += amount;
      } else if (tx.type === 'expense' && amount < 0) {
        monthData.expenses += Math.abs(amount); // Make positive
      }
    });

    // Convert to array format
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
    }));
  }

  private async getCurrentUserId(accessToken?: string, refreshToken?: string): Promise<string | null> {
    try {
      const { getCurrentUserId } = await import("@/src/application/shared/feature-guard");
      return await getCurrentUserId();
    } catch (error) {
      logger.error("[TransactionsRepository] Error getting current user ID:", error);
      return null;
    }
  }
}

