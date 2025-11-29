/**
 * Transactions Service
 * Business logic for transaction management
 */

import { TransactionsRepository } from "../../infrastructure/database/repositories/transactions.repository";
import { TransactionsMapper } from "./transactions.mapper";
import { TransactionFormData, TransactionUpdateData } from "../../domain/transactions/transactions.validations";
import { BaseTransaction, TransactionWithRelations, TransactionFilters, TransactionQueryResult } from "../../domain/transactions/transactions.types";
import { createServerClient } from "../../infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { guardTransactionLimit, throwIfNotAllowed, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";
import { logger } from "@/src/infrastructure/utils/logger";
import { invalidateTransactionCaches } from "../../infrastructure/cache/cache.manager";
import { encryptDescription, decryptDescription, normalizeDescription } from "@/src/infrastructure/utils/transaction-encryption";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";

// Helper function to get user subscription data
async function getUserSubscriptionData(userId: string) {
  const service = makeSubscriptionsService();
  return service.getUserSubscriptionData(userId);
}
import { suggestCategory } from "@/src/application/shared/category-learning";
import { TransactionRow } from "../../infrastructure/database/repositories/transactions.repository";

export class TransactionsService {
  constructor(private repository: TransactionsRepository) {}

  /**
   * Get transactions with filters
   */
  async getTransactions(
    filters?: TransactionFilters,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionQueryResult> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Get total count
    const total = await this.repository.count(filters, accessToken, refreshToken);

    // Get transactions
    const rows = await this.repository.findAll(filters, accessToken, refreshToken);

    // Decrypt descriptions
    const decryptedRows = rows.map(row => ({
      ...row,
      description: row.description ? decryptDescription(row.description) : null,
    }));

    // Fetch related data separately to avoid RLS issues
    const accountIds = [...new Set(decryptedRows.map(t => t.accountId))];
    const categoryIds = [...new Set(decryptedRows.map(t => t.categoryId).filter(Boolean) as string[])];
    const subcategoryIds = [...new Set(decryptedRows.map(t => t.subcategoryId).filter(Boolean) as string[])];

    // Fetch accounts
    const accountsMap = new Map<string, { id: string; name: string; type: string }>();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from("Account")
        .select("id, name, type")
        .in("id", accountIds);

      accounts?.forEach(account => {
        accountsMap.set(account.id, account);
      });
    }

    // Fetch categories
    const categoriesMap = new Map<string, { id: string; name: string; macroId?: string }>();
    if (categoryIds.length > 0) {
      const { data: categories } = await supabase
        .from("Category")
        .select("id, name, groupId")
        .in("id", categoryIds);

      categories?.forEach(category => {
        categoriesMap.set(category.id, { id: category.id, name: category.name, macroId: category.groupId });
      });
    }

    // Fetch subcategories
    const subcategoriesMap = new Map<string, { id: string; name: string; logo?: string | null }>();
    if (subcategoryIds.length > 0) {
      const { data: subcategories } = await supabase
        .from("Subcategory")
        .select("id, name, logo")
        .in("id", subcategoryIds);

      subcategories?.forEach(subcategory => {
        subcategoriesMap.set(subcategory.id, subcategory);
      });
    }

    // Map to domain entities with relations
    const transactions: TransactionWithRelations[] = decryptedRows.map(row => {
      const account = accountsMap.get(row.accountId);
      const category = row.categoryId ? categoriesMap.get(row.categoryId) : null;
      const subcategory = row.subcategoryId ? subcategoriesMap.get(row.subcategoryId) : null;

      return TransactionsMapper.toDomainWithRelations(row, {
        account: account ? { ...account, balance: undefined } : null,
        category: category ? { ...category, macro: undefined } : null,
        subcategory: subcategory || null,
      });
    });

    // Apply search filter in memory if provided
    let filteredTransactions = transactions;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTransactions = transactions.filter(tx => {
        const description = tx.description?.toLowerCase() || '';
        const accountName = tx.account?.name.toLowerCase() || '';
        const categoryName = tx.category?.name.toLowerCase() || '';
        return description.includes(searchLower) || 
               accountName.includes(searchLower) || 
               categoryName.includes(searchLower);
      });
    }

    return {
      transactions: filteredTransactions,
      total: filters?.search ? filteredTransactions.length : total,
    };
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionWithRelations | null> {
    const row = await this.repository.findById(id, accessToken, refreshToken);
    
    if (!row) {
      return null;
    }

    // Decrypt description
    const decryptedRow = {
      ...row,
      description: row.description ? decryptDescription(row.description) : null,
    };

    // Fetch relations
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const [accountResult, categoryResult, subcategoryResult] = await Promise.all([
      supabase.from("Account").select("id, name, type").eq("id", row.accountId).single(),
      row.categoryId ? supabase.from("Category").select("id, name, groupId").eq("id", row.categoryId).single() : Promise.resolve({ data: null }),
      row.subcategoryId ? supabase.from("Subcategory").select("id, name, logo").eq("id", row.subcategoryId).single() : Promise.resolve({ data: null }),
    ]);

    return TransactionsMapper.toDomainWithRelations(decryptedRow, {
      account: accountResult.data ? { ...accountResult.data, balance: undefined } : null,
      category: categoryResult.data ? { ...categoryResult.data, macro: undefined } : null,
      subcategory: subcategoryResult.data || null,
    });
  }

  /**
   * Create a new transaction
   */
  async createTransaction(
    data: TransactionFormData,
    providedUserId?: string
  ): Promise<BaseTransaction> {
    const supabase = await createServerClient();

    // Get user ID
    let userId: string;
    if (providedUserId) {
      // Server-side operation - validate account ownership
      const { data: account } = await supabase
        .from('Account')
        .select('userId')
        .eq('id', data.accountId)
        .single();

      if (!account) {
        throw new Error("Account not found");
      }

      if (account.userId !== null && account.userId !== providedUserId) {
        throw new Error("Unauthorized: Account does not belong to user");
      }

      userId = providedUserId;
    } else {
      // Client-side operation
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        throw new Error("User not authenticated");
      }
      userId = currentUserId;
    }

    // Check transaction limit
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const limitGuard = await guardTransactionLimit(userId, date);
    await throwIfNotAllowed(limitGuard);

    // Get plan limits
    const { limits } = await getUserSubscriptionData(userId);

    // Prepare data
    const now = formatTimestamp(new Date());
    const transactionDate = formatDateOnly(date);
    const encryptedDescription = encryptDescription(data.description || null);
    const descriptionSearch = normalizeDescription(data.description);

    // Get category suggestion if no category provided
    let categorySuggestion = null;
    if (!data.categoryId && data.description) {
      try {
        categorySuggestion = await suggestCategory(userId, data.description, data.amount, data.type);
      } catch (error) {
        logger.error('Error getting category suggestion:', error);
      }
    }

    const id = crypto.randomUUID();
    const finalCategoryId = data.type === "transfer" ? null : (data.categoryId || null);
    const finalSubcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);

    // Get active household ID
    const householdId = await getActiveHouseholdId(userId);

    let transactionRow: TransactionRow;

    // Handle transfers with toAccountId using SQL function
    if (data.type === "transfer" && data.toAccountId) {
      const result = await this.repository.createTransferWithLimit({
        userId,
        fromAccountId: data.accountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        date: transactionDate,
        description: encryptedDescription,
        descriptionSearch,
        recurring: data.recurring ?? false,
        maxTransactions: limits.maxTransactions,
      });

      if (!result) {
        throw new Error("Failed to create transfer");
      }

      // Fetch the created transaction
      const created = await this.repository.findById(result.id);
      if (!created) {
        throw new Error("Transaction created but not found");
      }
      transactionRow = created;
    } else {
      // Regular transaction or transfer with transferFromId
      const result = await this.repository.createTransactionWithLimit({
        userId,
        accountId: data.accountId,
        amount: data.amount,
        date: transactionDate,
        type: data.type,
        description: encryptedDescription,
        descriptionSearch,
        categoryId: finalCategoryId,
        subcategoryId: finalSubcategoryId,
        recurring: data.recurring ?? false,
        expenseType: data.type === "expense" ? (data.expenseType || null) : null,
        maxTransactions: limits.maxTransactions,
      });

      if (!result) {
        throw new Error("Failed to create transaction");
      }

      // Fetch the created transaction
      const created = await this.repository.findById(result.id);
      if (!created) {
        throw new Error("Transaction created but not found");
      }
      transactionRow = created;

      // Handle transferFromId for incoming transfers (e.g., credit card payments)
      if (data.type === "transfer" && data.transferFromId) {
        await this.repository.update(transactionRow.id, {
          transferFromId: data.transferFromId,
          updatedAt: now,
        });
        transactionRow = await this.repository.findById(transactionRow.id) || transactionRow;
      }
    }

    // Invalidate cache
    invalidateTransactionCaches();

    return TransactionsMapper.toDomain(transactionRow);
  }

  /**
   * Update a transaction
   */
  async updateTransaction(id: string, data: Partial<TransactionFormData>): Promise<BaseTransaction> {
    // Verify ownership
    await requireTransactionOwnership(id);

    const now = formatTimestamp(new Date());
    const updateData: Partial<TransactionRow> = { updatedAt: now };

    // Handle date
    if (data.date !== undefined) {
      const date = data.date instanceof Date ? data.date : new Date(data.date);
      updateData.date = formatDateOnly(date);
    }

    // Handle other fields
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.type === "transfer" ? null : (data.categoryId || null);
    }
    if (data.subcategoryId !== undefined) {
      updateData.subcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);
    }
    if (data.description !== undefined) {
      updateData.description = encryptDescription(data.description || null);
    }
    if (data.recurring !== undefined) updateData.recurring = data.recurring;
    if (data.expenseType !== undefined) {
      updateData.expenseType = data.type === "expense" ? (data.expenseType || null) : null;
    }
    if (data.toAccountId !== undefined) updateData.transferToId = data.toAccountId || null;
    if (data.transferFromId !== undefined) updateData.transferFromId = data.transferFromId || null;

    const row = await this.repository.update(id, updateData);

    // Invalidate cache
    invalidateTransactionCaches();

    return TransactionsMapper.toDomain(row);
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    // Verify ownership
    await requireTransactionOwnership(id);

    await this.repository.delete(id);

    // Invalidate cache
    invalidateTransactionCaches();
  }

  /**
   * Delete multiple transactions
   */
  async deleteMultipleTransactions(ids: string[]): Promise<void> {
    // Verify ownership of all transactions
    for (const id of ids) {
      await requireTransactionOwnership(id);
    }

    await this.repository.deleteMultiple(ids);

    // Invalidate cache
    invalidateTransactionCaches();
  }

  /**
   * Get account balance (helper method)
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const supabase = await createServerClient();

    // Get account initial balance
    const { data: account } = await supabase
      .from("Account")
      .select("initialBalance")
      .eq("id", accountId)
      .single();

    const initialBalance = (account?.initialBalance as number) ?? 0;

    // Get transactions up to today
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const transactions = await this.repository.getTransactionsForBalance(accountId, todayEnd);

    // Calculate balance
    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
    const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");

    const decryptedTransactions = decryptTransactionsBatch(transactions as any);
    const accountsWithInitialBalance = [{
      id: accountId,
      initialBalance,
      balance: 0,
    }];

    const balances = calculateAccountBalances(
      accountsWithInitialBalance as any,
      decryptedTransactions as any,
      todayEnd
    );

    return balances.get(accountId) || initialBalance;
  }
}

