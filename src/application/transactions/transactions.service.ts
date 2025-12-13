/**
 * Transactions Service
 * Business logic for transaction management
 */

import { ITransactionsRepository } from "@/src/infrastructure/database/repositories/interfaces/transactions.repository.interface";
import { IAccountsRepository } from "@/src/infrastructure/database/repositories/interfaces/accounts.repository.interface";
import { ICategoriesRepository } from "@/src/infrastructure/database/repositories/interfaces/categories.repository.interface";
import { TransactionsMapper } from "./transactions.mapper";
import { TransactionFormData } from "../../domain/transactions/transactions.validations";
import { BaseTransaction, TransactionWithRelations, TransactionFilters, TransactionQueryResult } from "../../domain/transactions/transactions.types";
import type { AccountWithBalance } from "../../domain/accounts/accounts.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { guardTransactionLimit, throwIfNotAllowed, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireTransactionOwnership } from "@/src/infrastructure/utils/security";
import { logger } from "@/src/infrastructure/utils/logger";
import { encryptDescription, decryptDescription, normalizeDescription, getTransactionAmount } from "@/src/infrastructure/utils/transaction-encryption";
import { makePlannedPaymentsService } from "@/src/application/planned-payments/planned-payments.factory";
import { AppError } from "../shared/app-error";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { TRANSACTION_IMPORT_BATCH_SIZE, TRANSACTION_IMPORT_BATCH_DELAY_MS, TRANSACTION_IMPORT_PROGRESS_INTERVAL } from "@/src/domain/shared/constants";

// Helper function to get user subscription data (uses cached function)
async function getUserSubscriptionData(userId: string) {
  return getCachedSubscriptionData(userId);
}
import { suggestCategory } from "@/src/application/shared/category-learning";
import { TransactionRow } from "@/src/infrastructure/database/repositories/transactions.repository";
import { detectSubscriptionsFromTransactions } from "./subscription-detection";
import { DetectedSubscription } from "../../domain/subscriptions/subscriptions.types";

export class TransactionsService {
  constructor(
    private repository: ITransactionsRepository,
    private accountsRepository: IAccountsRepository,
    private categoriesRepository: ICategoriesRepository
  ) {}

  /**
   * Get transactions with filters
   */
  async getTransactions(
    filters?: TransactionFilters,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TransactionQueryResult> {
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
    // Note: rows are still in snake_case format from repository
    const accountIds = [...new Set(decryptedRows.map(t => t.account_id))];
    const categoryIds = [...new Set(decryptedRows.map(t => t.category_id).filter(Boolean) as string[])];
    const subcategoryIds = [...new Set(decryptedRows.map(t => t.subcategory_id).filter(Boolean) as string[])];
    const suggestedCategoryIds = [...new Set(decryptedRows.map(t => t.suggested_category_id).filter(Boolean) as string[])];
    const suggestedSubcategoryIds = [...new Set(decryptedRows.map(t => t.suggested_subcategory_id).filter(Boolean) as string[])];

    // Fetch accounts using injected repository
    const accountsMap = new Map<string, { id: string; name: string; type: string }>();
    if (accountIds.length > 0) {
      const accounts = await this.accountsRepository.findByIds(accountIds, accessToken, refreshToken);

      accounts.forEach(account => {
        accountsMap.set(account.id, { id: account.id, name: account.name, type: account.type });
      });
    }

    // Fetch categories using injected repository
    const categoriesMap = new Map<string, { id: string; name: string }>();
    if (categoryIds.length > 0) {
      const categories = await this.categoriesRepository.findCategoriesByIds(categoryIds, accessToken, refreshToken);

      categories.forEach(category => {
        categoriesMap.set(category.id, { id: category.id, name: category.name });
      });
    }

    // Fetch subcategories using injected repository
    const subcategoriesMap = new Map<string, { id: string; name: string; logo?: string | null }>();
    if (subcategoryIds.length > 0) {
      const subcategories = await this.categoriesRepository.findSubcategoriesByIds(subcategoryIds, accessToken, refreshToken);

      subcategories.forEach(subcategory => {
        subcategoriesMap.set(subcategory.id, { id: subcategory.id, name: subcategory.name, logo: subcategory.logo });
      });
    }

    // Fetch suggested categories using injected repository
    const suggestedCategoriesMap = new Map<string, { id: string; name: string }>();
    if (suggestedCategoryIds.length > 0) {
      const suggestedCategories = await this.categoriesRepository.findCategoriesByIds(suggestedCategoryIds, accessToken, refreshToken);

      suggestedCategories.forEach(category => {
        suggestedCategoriesMap.set(category.id, { id: category.id, name: category.name });
      });
    }

    // Fetch suggested subcategories using injected repository
    const suggestedSubcategoriesMap = new Map<string, { id: string; name: string; logo?: string | null }>();
    if (suggestedSubcategoryIds.length > 0) {
      const suggestedSubcategories = await this.categoriesRepository.findSubcategoriesByIds(suggestedSubcategoryIds, accessToken, refreshToken);

      suggestedSubcategories.forEach(subcategory => {
        suggestedSubcategoriesMap.set(subcategory.id, { id: subcategory.id, name: subcategory.name, logo: subcategory.logo });
      });
    }

    // Map to domain entities with relations
    const transactions: TransactionWithRelations[] = decryptedRows.map(row => {
      const account = accountsMap.get(row.account_id);
      const category = row.category_id ? categoriesMap.get(row.category_id) : null;
      const subcategory = row.subcategory_id ? subcategoriesMap.get(row.subcategory_id) : null;
      const suggestedCategory = row.suggested_category_id ? suggestedCategoriesMap.get(row.suggested_category_id) : null;
      const suggestedSubcategory = row.suggested_subcategory_id ? suggestedSubcategoriesMap.get(row.suggested_subcategory_id) : null;

      return TransactionsMapper.toDomainWithRelations(row, {
        account: account ? { ...account, balance: undefined } : null,
        category: category ? { id: category.id, name: category.name } : null,
        subcategory: subcategory || null,
        suggestedCategory: suggestedCategory || null,
        suggestedSubcategory: suggestedSubcategory || null,
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
    const [account, category, subcategory, suggestedCategory, suggestedSubcategory] = await Promise.all([
      this.accountsRepository.findById(row.account_id, accessToken, refreshToken),
      row.category_id ? this.categoriesRepository.findCategoryById(row.category_id, accessToken, refreshToken) : Promise.resolve(null),
      row.subcategory_id ? this.categoriesRepository.findSubcategoryById(row.subcategory_id, accessToken, refreshToken) : Promise.resolve(null),
      row.suggested_category_id ? this.categoriesRepository.findCategoryById(row.suggested_category_id, accessToken, refreshToken) : Promise.resolve(null),
      row.suggested_subcategory_id ? this.categoriesRepository.findSubcategoryById(row.suggested_subcategory_id, accessToken, refreshToken) : Promise.resolve(null),
    ]);

    return TransactionsMapper.toDomainWithRelations(decryptedRow, {
      account: account ? { ...account, balance: undefined } : null,
      category: category || null,
      subcategory: subcategory || null,
      suggestedCategory: suggestedCategory || null,
      suggestedSubcategory: suggestedSubcategory || null,
    });
  }

  /**
   * Create a new transaction
   */
  async createTransaction(
    data: TransactionFormData,
    providedUserId?: string
  ): Promise<TransactionWithRelations> {
    const supabase = await createServerClient();

    // Get user ID
    let userId: string;
    if (providedUserId) {
      // Server-side operation - validate account ownership
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('user_id, id, name')
        .eq('id', data.accountId)
        .single();

      if (accountError || !account) {
        logger.error("[TransactionsService] Account lookup failed:", {
          accountId: data.accountId,
          error: accountError,
          userId: providedUserId,
        });
        throw new AppError(`Account not found: ${data.accountId}. Please check your account mapping.`, 404);
      }

      if (account.user_id !== null && account.user_id !== providedUserId) {
        throw new AppError("Unauthorized: Account does not belong to user", 401);
      }

      userId = providedUserId;
    } else {
      // Client-side operation
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        throw new AppError("User not authenticated", 401);
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
    // Note: Suggestion is generated but not automatically applied during creation
    // Users can apply suggestions later via the applySuggestion method
    if (!data.categoryId && data.description) {
      try {
        await suggestCategory(userId, data.description, data.amount, data.type);
        // Suggestion result is not used here, but the call helps train the category learning system
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
        isRecurring: data.recurring ?? false,
        maxTransactions: limits.maxTransactions,
      });

      if (!result || !result.id) {
        logger.error("[TransactionsService] Failed to create transfer - repository returned null or invalid result", {
          userId,
          fromAccountId: data.accountId,
          toAccountId: data.toAccountId,
          amount: data.amount,
          date: transactionDate,
          maxTransactions: limits.maxTransactions,
          result,
        });
        throw new AppError("Failed to create transfer. The transaction limit may have been exceeded or an unexpected error occurred.", 500);
      }

      // Try to fetch the created transaction
      // If not found (due to RLS or timing), construct it from the data we have
      let created = await this.repository.findById(result.id);
      
      if (!created) {
        // Transaction was created but not immediately visible (RLS/timing issue)
        // Construct the transaction row from the data we passed to the function
        logger.warn("[TransactionsService] Transfer created but not immediately fetchable, constructing from data", {
          id: result.id,
          userId,
        });
        
        created = {
          id: result.id,
          date: transactionDate,
          type: 'transfer' as const,
          amount: data.amount,
          account_id: data.accountId,
          category_id: null,
          subcategory_id: null,
          description: encryptedDescription,
          description_search: descriptionSearch,
          is_recurring: data.recurring ?? false,
          expense_type: null,
          transfer_to_id: data.toAccountId || null,
          transfer_from_id: null,
          created_at: now,
          updated_at: now,
          suggested_category_id: null,
          suggested_subcategory_id: null,
          user_id: userId,
          household_id: householdId,
          tags: null,
          receipt_url: null,
          deleted_at: null,
        } as TransactionRow;
      }
      
      transactionRow = created;

      // Handle receiptUrl if provided (for transfers)
      if (data.receiptUrl) {
        await this.repository.update(transactionRow.id, {
          receiptUrl: data.receiptUrl,
          updatedAt: now,
        });
        transactionRow = await this.repository.findById(transactionRow.id) || transactionRow;
      }

      // Merchant information is now stored directly in description or handled separately
      // No longer using plaidMetadata
    } else {
      // Regular transaction or transfer with transferFromId
      transactionRow = await this.repository.create({
        id,
        userId,
        accountId: data.accountId,
        amount: data.amount,
        date: transactionDate,
        type: data.type,
        description: encryptedDescription,
        categoryId: finalCategoryId,
        subcategoryId: finalSubcategoryId,
        isRecurring: data.recurring ?? false,
        expenseType: data.type === "expense" ? (data.expenseType || null) : null,
        transferToId: data.type === "transfer" && data.toAccountId ? data.toAccountId : null,
        transferFromId: null, // Will be set below if needed
        householdId,
        createdAt: now,
        updatedAt: now,
      });

      // Handle transferFromId for incoming transfers (e.g., credit card payments)
      if (data.type === "transfer" && data.transferFromId) {
        await this.repository.update(transactionRow.id, {
          transferFromId: data.transferFromId,
          updatedAt: now,
        });
        transactionRow = await this.repository.findById(transactionRow.id) || transactionRow;
      }

      // Handle receiptUrl if provided
      if (data.receiptUrl) {
        await this.repository.update(transactionRow.id, {
          receiptUrl: data.receiptUrl,
          updatedAt: now,
        });
        transactionRow = await this.repository.findById(transactionRow.id) || transactionRow;
      }

      // Merchant information is now stored directly in description or handled separately
      // No longer using plaidMetadata
    }

    // Fetch related data (account, category, subcategory) to return complete transaction
    const accountIds = [transactionRow.account_id];
    const categoryIds = transactionRow.category_id ? [transactionRow.category_id] : [];
    const subcategoryIds = transactionRow.subcategory_id ? [transactionRow.subcategory_id] : [];

    // Fetch account
    const accountsMap = new Map<string, { id: string; name: string; type: string }>();
    if (accountIds.length > 0) {
      const accounts = await this.accountsRepository.findByIds(accountIds);
      accounts.forEach(account => {
        accountsMap.set(account.id, { id: account.id, name: account.name, type: account.type });
      });
    }

    // Fetch category
    const categoriesMap = new Map<string, { id: string; name: string }>();
    if (categoryIds.length > 0) {
      const categories = await this.categoriesRepository.findCategoriesByIds(categoryIds);
      categories.forEach(category => {
        categoriesMap.set(category.id, { id: category.id, name: category.name });
      });
    }

    // Fetch subcategory
    const subcategoriesMap = new Map<string, { id: string; name: string; logo?: string | null }>();
    if (subcategoryIds.length > 0) {
      const subcategories = await this.categoriesRepository.findSubcategoriesByIds(subcategoryIds);
      subcategories.forEach(subcategory => {
        subcategoriesMap.set(subcategory.id, { id: subcategory.id, name: subcategory.name, logo: subcategory.logo });
      });
    }

    const account = accountsMap.get(transactionRow.account_id);
    const category = transactionRow.category_id ? categoriesMap.get(transactionRow.category_id) : null;
    const subcategory = transactionRow.subcategory_id ? subcategoriesMap.get(transactionRow.subcategory_id) : null;

    // Decrypt description before returning
    const decryptedRow = {
      ...transactionRow,
      description: transactionRow.description ? decryptDescription(transactionRow.description) : null,
    };

    return TransactionsMapper.toDomainWithRelations(decryptedRow, {
      account: account ? { ...account, balance: undefined } : null,
      category: category || null,
      subcategory: subcategory || null,
    });
  }

  /**
   * Update a transaction
   */
  async updateTransaction(id: string, data: Partial<TransactionFormData>): Promise<TransactionWithRelations> {
    // Verify ownership
    await requireTransactionOwnership(id);

    const now = formatTimestamp(new Date());
    const updateData: Parameters<ITransactionsRepository['update']>[1] = { updatedAt: now };

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
    if (data.recurring !== undefined) updateData.isRecurring = data.recurring;
    if (data.expenseType !== undefined) {
      updateData.expenseType = data.type === "expense" ? (data.expenseType || null) : null;
    }
    if (data.toAccountId !== undefined) updateData.transferToId = data.toAccountId || null;
    if (data.transferFromId !== undefined) updateData.transferFromId = data.transferFromId || null;
    if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl || null;

    // Merchant information is now stored directly in description or handled separately
    // No longer using plaidMetadata

    const row = await this.repository.update(id, updateData);

    // Fetch related data (account, category, subcategory) to return complete transaction
    const accountIds = [row.account_id];
    const categoryIds = row.category_id ? [row.category_id] : [];
    const subcategoryIds = row.subcategory_id ? [row.subcategory_id] : [];

    // Fetch account
    const accountsMap = new Map<string, { id: string; name: string; type: string }>();
    if (accountIds.length > 0) {
      const accounts = await this.accountsRepository.findByIds(accountIds);
      accounts.forEach(account => {
        accountsMap.set(account.id, { id: account.id, name: account.name, type: account.type });
      });
    }

    // Fetch category
    const categoriesMap = new Map<string, { id: string; name: string }>();
    if (categoryIds.length > 0) {
      const categories = await this.categoriesRepository.findCategoriesByIds(categoryIds);
      categories.forEach(category => {
        categoriesMap.set(category.id, { id: category.id, name: category.name });
      });
    }

    // Fetch subcategory
    const subcategoriesMap = new Map<string, { id: string; name: string; logo?: string | null }>();
    if (subcategoryIds.length > 0) {
      const subcategories = await this.categoriesRepository.findSubcategoriesByIds(subcategoryIds);
      subcategories.forEach(subcategory => {
        subcategoriesMap.set(subcategory.id, { id: subcategory.id, name: subcategory.name, logo: subcategory.logo });
      });
    }

    const account = accountsMap.get(row.account_id);
    const category = row.category_id ? categoriesMap.get(row.category_id) : null;
    const subcategory = row.subcategory_id ? subcategoriesMap.get(row.subcategory_id) : null;

    // Decrypt description before returning
    const decryptedRow = {
      ...row,
      description: row.description ? decryptDescription(row.description) : null,
    };

    return TransactionsMapper.toDomainWithRelations(decryptedRow, {
      account: account ? { ...account, balance: undefined } : null,
      category: category || null,
      subcategory: subcategory || null,
    });
  }

  /**
   * Soft delete a transaction (temporary, for undo functionality)
   */
  async softDeleteTransaction(id: string): Promise<void> {
    // Verify ownership
    await requireTransactionOwnership(id);

    await this.repository.softDelete(id);
  }

  /**
   * Delete a transaction (hard delete - permanent)
   * Note: includeDeleted=true because transaction may be soft-deleted
   */
  async deleteTransaction(id: string): Promise<void> {
    // Verify ownership (include deleted transactions since they may be soft-deleted)
    await requireTransactionOwnership(id, true);

    await this.repository.delete(id);
  }

  /**
   * Soft delete multiple transactions (temporary, for undo functionality)
   */
  async softDeleteMultipleTransactions(ids: string[]): Promise<void> {
    // Verify ownership of all transactions
    for (const id of ids) {
      await requireTransactionOwnership(id);
    }

    await this.repository.softDeleteMultiple(ids);
  }

  /**
   * Delete multiple transactions (hard delete - permanent)
   * Note: includeDeleted=true because transactions may be soft-deleted
   */
  async deleteMultipleTransactions(ids: string[]): Promise<void> {
    // Verify ownership of all transactions (include deleted since they may be soft-deleted)
    for (const id of ids) {
      await requireTransactionOwnership(id, true);
    }

    await this.repository.deleteMultiple(ids);
  }

  /**
   * Restore transactions (undo soft delete)
   */
  async restoreTransactions(ids: string[]): Promise<void> {
    // Verify ownership of all transactions
    for (const id of ids) {
      await requireTransactionOwnership(id);
    }

    await this.repository.restore(ids);
  }

  /**
   * Get account balance (helper method)
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const supabase = await createServerClient();

    // Get account data (need name and type for AccountWithBalance type)
    const { data: account } = await supabase
      .from("accounts")
      .select("initialBalance, name, type")
      .eq("id", accountId)
      .single();

    if (!account) {
      throw new AppError("Account not found", 404);
    }

    const initialBalance = (account.initialBalance as number) ?? 0;

    // Get transactions up to today
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const transactions = await this.repository.getTransactionsForBalance(accountId, todayEnd);

    // Calculate balance
    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
    const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");

    // Decrypt transactions - decryptTransactionsBatch expects { amount: number; description?: string | null }[]
    // The transactions from getTransactionsForBalance have { accountId, type, amount, date }
    // We need to add description as optional to satisfy the type constraint
    type TransactionForDecryption = {
      accountId: string;
      type: string;
      amount: number;
      date: string;
      description?: string | null;
    };
    const transactionsWithDescription: TransactionForDecryption[] = transactions.map(tx => ({
      ...tx,
      description: null,
    }));

    const decryptedTransactions = decryptTransactionsBatch(transactionsWithDescription);

    // Map to TransactionWithRelations format expected by calculateAccountBalances
    const mappedTransactions: TransactionWithRelations[] = decryptedTransactions.map(tx => ({
      id: '', // Not needed for balance calculation
      date: tx.date,
      type: tx.type as 'income' | 'expense' | 'transfer',
      amount: tx.amount,
      accountId: tx.accountId,
      description: tx.description ?? null,
    }));

    // Create AccountWithBalance object with required properties
    const accountWithBalance: AccountWithBalance = {
      id: accountId,
      name: account.name || '',
      type: (account.type as 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other') || 'other',
      initialBalance,
      balance: 0,
    };

    const balances = calculateAccountBalances(
      [accountWithBalance],
      mappedTransactions,
      todayEnd
    );

    return balances.get(accountId) || initialBalance;
  }

  /**
   * Get transactions by IDs
   */
  async getTransactionsByIds(
    ids: string[],
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{
    id: string;
    date: string;
    amount: number;
    description: string | null;
    account: { id: string; name: string } | null;
  }>> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError("ids must be a non-empty array", 400);
    }

    const transactions = await this.repository.findByIds(ids, userId, accessToken, refreshToken);

    // Format transactions with decrypted descriptions and formatted amounts
    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      amount: getTransactionAmount(tx.amount) ?? 0,
      description: decryptDescription(tx.description),
      account: Array.isArray(tx.account) ? (tx.account.length > 0 ? tx.account[0] : null) : tx.account,
    }));
  }

  /**
   * Create an import job for large CSV imports
   */
  async createImportJob(
    userId: string,
    accountId: string,
    transactions: Array<{
      date: string | Date;
      type: "expense" | "income" | "transfer";
      amount: number;
      accountId: string;
      toAccountId?: string;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      recurring?: boolean;
      expenseType?: "fixed" | "variable" | null;
      rowIndex?: number;
      fileName?: string;
    }>
  ): Promise<string> {
    const supabase = await createServerClient();
    const jobId = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    const { error: jobError } = await supabase
      .from('system_jobs_imports')
      .insert({
        id: jobId,
        userId: userId,
        accountId: accountId,
        type: 'csv_import',
        status: 'pending',
        totalItems: transactions.length,
        metadata: {
          transactions: transactions.map(tx => ({
            date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
            type: tx.type,
            amount: tx.amount,
            accountId: tx.accountId,
            toAccountId: tx.toAccountId,
            categoryId: tx.categoryId || null,
            subcategoryId: tx.subcategoryId || null,
            description: tx.description || null,
            recurring: tx.recurring ?? false,
            expenseType: tx.expenseType || null,
            rowIndex: tx.rowIndex,
            fileName: tx.fileName,
          })),
        },
        createdAt: now,
        updatedAt: now,
      });

    if (jobError) {
      logger.error("[TransactionsService] Error creating import job:", jobError);
      throw new AppError("Failed to create import job", 500);
    }

    return jobId;
  }

  /**
   * Import multiple transactions (for CSV import)
   * CRITICAL: Validates limit BEFORE creating any transactions to prevent partial creation
   * Supports progress tracking via jobId (optional)
   */
  async importTransactions(
    userId: string,
    transactions: Array<{
      date: string | Date;
      type: "expense" | "income" | "transfer";
      amount: number;
      accountId: string;
      toAccountId?: string;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      recurring?: boolean;
      expenseType?: "fixed" | "variable" | null;
    }>,
    jobId?: string
  ): Promise<{
    imported: number;
    errors: number;
    errorDetails: Array<{ rowIndex: number; fileName?: string; error: string }>;
  }> {
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      throw new AppError("No transactions provided", 400);
    }

    // CRITICAL: Validate limit BEFORE creating any transactions
    // Group transactions by month to check limits per month
    const transactionsByMonth = new Map<string, Array<{ date: Date; index: number }>>();
    
    transactions.forEach((tx, index) => {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!transactionsByMonth.has(monthKey)) {
        transactionsByMonth.set(monthKey, []);
      }
      transactionsByMonth.get(monthKey)!.push({ date, index });
    });

    // Check limit for each month
    for (const [monthKey, monthTransactions] of transactionsByMonth.entries()) {
      const firstTransaction = monthTransactions[0];
      const { guardBulkTransactionLimit, throwIfNotAllowed } = await import("@/src/application/shared/feature-guard");
      
      const limitGuard = await guardBulkTransactionLimit(
        userId,
        monthTransactions.length,
        firstTransaction.date
      );
      await throwIfNotAllowed(limitGuard);
    }

    // Initialize progress tracking if jobId provided
    if (jobId) {
      const { progressTracker } = await import("@/src/infrastructure/utils/progress-tracker");
      progressTracker.create(jobId, transactions.length, `Importing ${transactions.length} transactions...`);
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ rowIndex: number; fileName?: string; error: string }> = [];

    // Process transactions in batches to avoid rate limiting
    for (let i = 0; i < transactions.length; i += TRANSACTION_IMPORT_BATCH_SIZE) {
      const batch = transactions.slice(i, i + TRANSACTION_IMPORT_BATCH_SIZE);
      
      // Process batch with a small delay between batches to avoid rate limiting
      await Promise.allSettled(
        batch.map(async (tx, index) => {
          try {
            // Validate accountId exists before attempting to create transaction
            if (!tx.accountId) {
              throw new AppError("Account ID is required", 400);
            }

            // Convert date string to Date object if needed
            const data: TransactionFormData = {
              date: tx.date instanceof Date ? tx.date : new Date(tx.date),
              type: tx.type,
              amount: tx.amount,
              accountId: tx.accountId,
              toAccountId: tx.toAccountId,
              categoryId: tx.categoryId || undefined,
              subcategoryId: tx.subcategoryId || undefined,
              description: tx.description || undefined,
              recurring: tx.recurring ?? false,
              expenseType: tx.expenseType || undefined,
            };
            
            await this.createTransaction(data, userId);
            successCount++;
          } catch (error) {
            errorCount++;
            let errorMessage = "Unknown error";
            
            if (error instanceof AppError) {
              errorMessage = error.message;
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }
            
            const globalIndex = i + index;
            errors.push({
              rowIndex: (tx as any).rowIndex || globalIndex + 1,
              fileName: (tx as any).fileName,
              error: errorMessage,
            });
            logger.error("[TransactionsService] Error importing transaction:", {
              error,
              accountId: tx.accountId,
              rowIndex: (tx as any).rowIndex || globalIndex + 1,
              fileName: (tx as any).fileName,
            });
          }
        })
      );

      // Update progress if jobId provided (simplified: update every N transactions, not every batch)
      if (jobId && (i + TRANSACTION_IMPORT_BATCH_SIZE) % TRANSACTION_IMPORT_PROGRESS_INTERVAL === 0) {
        const { progressTracker } = await import("@/src/infrastructure/utils/progress-tracker");
        const processed = Math.min(i + TRANSACTION_IMPORT_BATCH_SIZE, transactions.length);
        progressTracker.update(jobId, processed, `Processed ${processed} of ${transactions.length} transactions...`);
      }

      // Add a small delay between batches to avoid rate limiting
      if (i + TRANSACTION_IMPORT_BATCH_SIZE < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, TRANSACTION_IMPORT_BATCH_DELAY_MS));
      }
    }

    // Mark as completed if jobId provided
    if (jobId) {
      const { progressTracker } = await import("@/src/infrastructure/utils/progress-tracker");
      progressTracker.complete(jobId, `Import completed: ${successCount} imported, ${errorCount} errors`);
    }

    return {
      imported: successCount,
      errors: errorCount,
      errorDetails: errors,
    };
  }

  /**
   * Apply suggestion to a transaction
   */
  async applySuggestion(id: string): Promise<BaseTransaction> {
    // Verify ownership
    await requireTransactionOwnership(id);

    // Get transaction with suggestions
    const transactionRow = await this.repository.findByIdWithSuggestions(id);
    if (!transactionRow) {
      throw new AppError("Transaction not found", 404);
    }

    // Map to domain entity to access camelCase fields
    const transaction = TransactionsMapper.toDomain(transactionRow);

    if (!transaction.suggestedCategoryId) {
      throw new AppError("No suggested category found for this transaction", 400);
    }

    // Apply the suggestion by moving it to the actual category
    const updatedTransaction = await this.updateTransaction(id, {
      categoryId: transaction.suggestedCategoryId,
      subcategoryId: transaction.suggestedSubcategoryId || undefined,
    });

    // Clear suggested fields
    await this.repository.clearSuggestions(id);

    return updatedTransaction;
  }

  /**
   * Reject suggestion for a transaction
   */
  async rejectSuggestion(id: string): Promise<BaseTransaction> {
    // Verify ownership
    await requireTransactionOwnership(id);

    // Get transaction with suggestions
    const transactionRow = await this.repository.findByIdWithSuggestions(id);
    if (!transactionRow) {
      throw new AppError("Transaction not found", 404);
    }

    // Map to domain entity to access camelCase fields
    const transaction = TransactionsMapper.toDomain(transactionRow);

    if (!transaction.suggestedCategoryId) {
      throw new AppError("No suggested category found for this transaction", 400);
    }

    // Clear suggested fields
    const updatedRow = await this.repository.clearSuggestions(id);

    return TransactionsMapper.toDomain(updatedRow);
  }

  /**
   * Generate suggestions for uncategorized transactions
   */
  async generateSuggestions(userId: string, limit: number = 100): Promise<{
    processed: number;
    errors: number;
    total: number;
  }> {
    // Get uncategorized transactions
    const transactions = await this.repository.findUncategorizedForSuggestions(userId, limit);

    if (transactions.length === 0) {
      return {
        processed: 0,
        errors: 0,
        total: 0,
      };
    }

    let processed = 0;
    let errors = 0;

    // Process each transaction
    for (const tx of transactions) {
      try {
        if (!tx.description) continue;

        // Get category suggestion
        const suggestion = await suggestCategory(
          tx.userId || userId,
          tx.description,
          tx.amount,
          tx.type
        );

        if (suggestion) {
          // Update transaction with suggestion
          await this.repository.updateSuggestions(tx.id, {
            suggestedCategoryId: suggestion.categoryId,
            suggestedSubcategoryId: suggestion.subcategoryId || null,
          });

          processed++;
          logger.log(`[TransactionsService] Generated suggestion for transaction ${tx.id}:`, {
            suggestedCategoryId: suggestion.categoryId,
            confidence: suggestion.confidence,
            matchCount: suggestion.matchCount,
          });
        }
      } catch (error) {
        logger.error(`[TransactionsService] Error processing transaction ${tx.id}:`, error);
        errors++;
      }
    }

    return {
      processed,
      errors,
      total: transactions.length,
    };
  }

  /**
   * Get upcoming transactions (planned payments + recurring transactions)
   */
  async getUpcomingTransactions(
    limit: number = 5,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{
    id: string;
    date: Date;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description?: string;
    account: { id: string; name: string; type?: string; balance?: number } | null;
      category: { id: string; name: string } | null;
    subcategory: { id: string; name: string; logo?: string | null } | null;
    originalDate: Date;
    isDebtPayment: boolean;
  }>> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 15); // Look ahead 15 days
    endDate.setHours(23, 59, 59, 999);

    // Get all scheduled planned payments
    const plannedPaymentsService = makePlannedPaymentsService();
    const result = await plannedPaymentsService.getPlannedPayments({
      startDate: today,
      endDate: endDate,
      status: "scheduled",
    }, accessToken, refreshToken);
    const plannedPayments = result?.plannedPayments || [];

    // Convert PlannedPayments to the expected format
    const upcoming = plannedPayments.map((pp) => {
      const ppDate = pp.date instanceof Date ? pp.date : new Date(pp.date);
      return {
        id: pp.id,
        date: ppDate,
        type: pp.type,
        amount: pp.amount,
        description: pp.description || undefined,
        account: pp.account ? { id: pp.account.id, name: pp.account.name } : null,
        category: pp.category ? { id: pp.category.id, name: pp.category.name } : null,
        subcategory: pp.subcategory ? { id: pp.subcategory.id, name: pp.subcategory.name, logo: pp.subcategory.logo ?? null } : null,
        originalDate: ppDate,
        isDebtPayment: pp.source === "debt",
      };
    });

    // Also get recurring transactions and generate planned payments for them
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: recurringTransactions, error: recurringError } = await supabase
      .from("transactions")
      .select(`
        *,
        account:accounts(*),
        category:categories!transactions_categoryid_fkey(*),
        subcategory:subcategories!transactions_subcategoryid_fkey(id, name, logo)
      `)
      .eq("is_recurring", true)
      .order("date", { ascending: true });

    if (recurringError) {
      logger.error("[TransactionsService] Error fetching recurring transactions:", recurringError);
    }

    // Generate planned payments for recurring transactions (if not already created)
    for (const tx of recurringTransactions || []) {
      const originalDate = new Date(tx.date);
      const originalDay = originalDate.getDate();
      
      // Calculate next occurrence
      let nextDate = new Date(today.getFullYear(), today.getMonth(), originalDay);
      nextDate.setHours(0, 0, 0, 0);
      
      if (nextDate.getDate() !== originalDay) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        nextDate.setHours(0, 0, 0, 0);
      }

      if (nextDate < today) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, originalDay);
        nextDate.setHours(0, 0, 0, 0);
        if (nextDate.getDate() !== originalDay) {
          nextDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
          nextDate.setHours(0, 0, 0, 0);
        }
      }

      // Only include if within the next 15 days and not already in planned payments
      if (nextDate <= endDate) {
        const alreadyExists = plannedPayments.some(
          (pp) => pp.source === "recurring" && 
          new Date(pp.date).getTime() === nextDate.getTime() &&
          pp.accountId === tx.accountId &&
          pp.amount === (getTransactionAmount(tx.amount) ?? 0)
        );

        if (!alreadyExists) {
          let account = null;
          if (tx.account) {
            account = Array.isArray(tx.account) ? (tx.account.length > 0 ? tx.account[0] : null) : tx.account;
          }

          let category = null;
          if (tx.category) {
            category = Array.isArray(tx.category) ? (tx.category.length > 0 ? tx.category[0] : null) : tx.category;
          }

          let subcategory = null;
          if (tx.subcategory) {
            subcategory = Array.isArray(tx.subcategory) ? (tx.subcategory.length > 0 ? tx.subcategory[0] : null) : tx.subcategory;
          }

          upcoming.push({
            id: `recurring-${tx.id}-${nextDate.toISOString()}`,
            date: nextDate,
            type: tx.type,
            amount: getTransactionAmount(tx.amount) ?? 0,
            description: decryptDescription(tx.description) ?? undefined,
            account: account || null,
            category: category || null,
            subcategory: subcategory || null,
            originalDate: originalDate,
            isDebtPayment: false,
          });
        }
      }
    }

    // Also get regular transactions (non-recurring) and transfers with future dates
    const { data: futureTransactions, error: futureError } = await supabase
      .from("transactions")
      .select(`
        *,
        account:accounts(*),
        category:categories!transactions_categoryid_fkey(*),
        subcategory:subcategories!transactions_subcategoryid_fkey(id, name, logo)
      `)
      .gte("date", today.toISOString().split('T')[0])
      .lte("date", endDate.toISOString().split('T')[0])
      .eq("is_recurring", false) // Only non-recurring
      .in("type", ["expense", "income", "transfer"])
      .is("deleted_at", null)
      .order("date", { ascending: true });

    if (futureError) {
      logger.error("[TransactionsService] Error fetching future transactions:", futureError);
    }

    // Add future transactions to upcoming list (avoid duplicates)
    for (const tx of futureTransactions || []) {
      const txDate = new Date(tx.date);
      txDate.setHours(0, 0, 0, 0);

      // Check if this transaction is already in the upcoming list
      // (could be a planned payment or recurring transaction)
      const alreadyExists = upcoming.some(
        (up) => {
          const upDate = up.date instanceof Date ? up.date : new Date(up.date);
          upDate.setHours(0, 0, 0, 0);
          return (
            upDate.getTime() === txDate.getTime() &&
            up.account?.id === tx.accountId &&
            Math.abs(up.amount - (getTransactionAmount(tx.amount) ?? 0)) < 0.01 // Allow small floating point differences
          );
        }
      );

      if (!alreadyExists) {
        let account = null;
        if (tx.account) {
          const accountData = Array.isArray(tx.account) ? (tx.account.length > 0 ? tx.account[0] : null) : tx.account;
          if (accountData) {
            account = {
              id: accountData.id,
              name: accountData.name,
            };
          }
        }

        let category = null;
        if (tx.category) {
          const categoryData = Array.isArray(tx.category) ? (tx.category.length > 0 ? tx.category[0] : null) : tx.category;
          if (categoryData) {
            category = {
              id: categoryData.id,
              name: categoryData.name,
            };
          }
        }

        let subcategory = null;
        if (tx.subcategory) {
          const subcategoryData = Array.isArray(tx.subcategory) ? (tx.subcategory.length > 0 ? tx.subcategory[0] : null) : tx.subcategory;
          if (subcategoryData) {
            subcategory = {
              id: subcategoryData.id,
              name: subcategoryData.name,
              logo: subcategoryData.logo ?? null,
            };
          }
        }

        upcoming.push({
          id: tx.id,
          date: txDate,
          type: tx.type,
          amount: getTransactionAmount(tx.amount) ?? 0,
          description: decryptDescription(tx.description) ?? undefined,
          account: account,
          category: category,
          subcategory: subcategory,
          originalDate: txDate,
          isDebtPayment: false,
        });
      }
    }

    // Sort by date and limit
    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return upcoming.slice(0, limit);
  }

  /**
   * Get aggregated monthly transaction data for charts
   * OPTIMIZED: Returns only monthly totals instead of all transactions
   * This is much faster for chart rendering
   */
  async getMonthlyAggregates(
    startDate: Date,
    endDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ month: string; income: number; expenses: number }>> {
    return await this.repository.findMonthlyAggregates(startDate, endDate, accessToken, refreshToken);
  }

  /**
   * Detect subscriptions from user transactions
   * SIMPLIFIED: Integrated into TransactionsService instead of separate service
   * Uses repository for data access, making it more maintainable
   */
  async detectSubscriptions(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<DetectedSubscription[]> {
    return detectSubscriptionsFromTransactions(
      userId,
      this.repository,
      this.accountsRepository
    );
  }
}

