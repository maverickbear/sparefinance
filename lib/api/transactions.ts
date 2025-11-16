"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { TransactionFormData } from "@/lib/validations/transaction";
import { formatTimestamp, formatDateStart, formatDateEnd, formatDateOnly, getCurrentTimestamp } from "@/lib/utils/timestamp";
import { getDebts } from "@/lib/api/debts";
import { calculateNextPaymentDates, type DebtForCalculation } from "@/lib/utils/debts";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { guardTransactionLimit, getCurrentUserId, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { requireTransactionOwnership } from "@/lib/utils/security";
import { suggestCategory, updateCategoryLearning } from "@/lib/api/category-learning";
import { logger } from "@/lib/utils/logger";
import { encryptDescription, decryptDescription, encryptAmount, decryptAmount, normalizeDescription } from "@/lib/utils/transaction-encryption";
import { checkPlanLimits } from "@/lib/api/plans";

export async function createTransaction(data: TransactionFormData) {
    const supabase = await createServerClient();

  // Get current user and validate transaction limit
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }
  
  const userId = user.id;

  // Check transaction limit before creating (still check here for early validation)
  const limitGuard = await guardTransactionLimit(userId, data.date instanceof Date ? data.date : new Date(data.date));
  await throwIfNotAllowed(limitGuard);

  // Get plan limits for SQL function
  const { limits } = await checkPlanLimits(userId);

  // Ensure date is a Date object
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  
  // Format date for PostgreSQL date type (YYYY-MM-DD)
  const transactionDate = formatDateOnly(date);

  // Prepare auxiliary fields
  const encryptedDescription = encryptDescription(data.description || null);
  const encryptedAmount = encryptAmount(data.amount);
  const descriptionSearch = normalizeDescription(data.description);
  const amountNumeric = data.amount;

  // Get category suggestion from learning model if no category is provided
  let categorySuggestion = null;
  if (!data.categoryId && data.description) {
    try {
      categorySuggestion = await suggestCategory(
        userId,
        data.description,
        data.amount,
        data.type
      );
      logger.log('Category suggestion for manual transaction:', {
        description: data.description?.substring(0, 50),
        amount: data.amount,
        type: data.type,
        suggestion: categorySuggestion ? {
          categoryId: categorySuggestion.categoryId,
          confidence: categorySuggestion.confidence,
          matchCount: categorySuggestion.matchCount,
        } : null,
      });
    } catch (error) {
      logger.error('Error getting category suggestion:', error);
      // Continue without suggestion if there's an error
    }
  }

  // Generate UUID for transaction
  const id = crypto.randomUUID();

  // Use provided category if available, otherwise null (don't auto-categorize even with high confidence)
  // We'll always show suggestions for user approval/rejection
  // For transfers, don't use categories
  const finalCategoryId = data.type === "transfer" ? null : (data.categoryId || null);
  const finalSubcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);

  // For transfers, use SQL function for atomic creation
  if (data.type === "transfer" && data.toAccountId) {
    const { data: transferResult, error: transferError } = await supabase.rpc(
      'create_transfer_with_limit',
      {
        p_user_id: userId,
        p_from_account_id: data.accountId,
        p_to_account_id: data.toAccountId,
        p_amount: encryptedAmount,
        p_amount_numeric: amountNumeric,
        p_date: transactionDate,
        p_description: encryptedDescription,
        p_description_search: descriptionSearch,
        p_recurring: data.recurring ?? false,
        p_max_transactions: limits.maxTransactions,
      }
    );

    if (transferError) {
      logger.error("Error creating transfer via SQL function:", transferError);
      throw new Error(`Failed to create transfer transaction: ${transferError.message || JSON.stringify(transferError)}`);
    }

    // Fetch the created outgoing transaction to return
    // transferResult is a jsonb object, so we need to access it correctly
    const result = Array.isArray(transferResult) ? transferResult[0] : transferResult;
    const outgoingId = result?.outgoing_id;
    if (!outgoingId) {
      throw new Error("Failed to get outgoing transaction ID from transfer function");
    }
    
    const { data: outgoingTransaction, error: fetchError } = await supabase
      .from("Transaction")
      .select("*")
      .eq("id", outgoingId)
      .single();

    if (fetchError || !outgoingTransaction) {
      logger.error("Error fetching created transfer transaction:", fetchError);
      throw new Error("Failed to fetch created transfer transaction");
    }

    // Invalidate cache to ensure dashboard shows updated data
    const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
    invalidateTransactionCaches();

    // Update category_learning if category was provided (shouldn't happen for transfers, but just in case)
    if (finalCategoryId) {
      await updateCategoryLearning(userId, descriptionSearch, data.type, finalCategoryId, finalSubcategoryId, data.amount);
    }

    // Return the outgoing transaction as the main one
    return outgoingTransaction;
  }

  // Regular transaction (expense or income) - use SQL function for atomic creation
  const { data: transactionResult, error: transactionError } = await supabase.rpc(
    'create_transaction_with_limit',
    {
      p_id: id,
      p_date: transactionDate,
      p_type: data.type,
      p_amount: encryptedAmount,
      p_amount_numeric: amountNumeric,
      p_account_id: data.accountId,
      p_user_id: userId,
      p_category_id: finalCategoryId,
      p_subcategory_id: finalSubcategoryId,
      p_description: encryptedDescription,
      p_description_search: descriptionSearch,
      p_recurring: data.recurring ?? false,
      p_expense_type: data.type === "expense" ? (data.expenseType || null) : null,
      p_created_at: now,
      p_updated_at: now,
      p_max_transactions: limits.maxTransactions,
    }
  );

  if (transactionError) {
    logger.error("Error creating transaction via SQL function:", transactionError);
    throw new Error(`Failed to create transaction: ${transactionError.message || JSON.stringify(transactionError)}`);
  }

  // Fetch the created transaction
  const { data: transaction, error: fetchError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !transaction) {
    logger.error("Error fetching created transaction:", fetchError);
    throw new Error("Failed to fetch created transaction");
  }

  // If we have a suggestion (any confidence level), save it for user approval/rejection
  if (categorySuggestion) {
    const { error: updateError } = await supabase
      .from('Transaction')
      .update({
        suggestedCategoryId: categorySuggestion.categoryId,
        suggestedSubcategoryId: categorySuggestion.subcategoryId || null,
        updatedAt: formatTimestamp(new Date()),
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating transaction with suggestion:', updateError);
    } else {
      logger.log('Transaction updated with category suggestion:', {
        transactionId: id,
        suggestedCategoryId: categorySuggestion.categoryId,
        confidence: categorySuggestion.confidence,
        matchCount: categorySuggestion.matchCount,
      });
    }
  }

  // Update category_learning when category is confirmed
  if (finalCategoryId) {
    await updateCategoryLearning(userId, descriptionSearch, data.type, finalCategoryId, finalSubcategoryId, data.amount);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();

  return transaction;
}

export async function updateTransaction(id: string, data: Partial<TransactionFormData>) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireTransactionOwnership(id);

  // Get current transaction type if we need to validate expenseType
  let currentType: string | undefined = data.type;
  if (data.expenseType !== undefined && !currentType) {
    const { data: currentTransaction } = await supabase
      .from("Transaction")
      .select("type")
      .eq("id", id)
      .single();
    currentType = currentTransaction?.type;
  }

  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date value");
    }
    // Use formatDateOnly to save only the date (YYYY-MM-DD) - now date type, not timestamp
    updateData.date = formatDateOnly(date);
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) {
    updateData.amount = encryptAmount(data.amount);
    // Also update amount_numeric when amount changes
    updateData.amount_numeric = data.amount;
  }
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId || null;
  if (data.description !== undefined) {
    updateData.description = encryptDescription(data.description || null);
    // Also update description_search when description changes
    updateData.description_search = normalizeDescription(data.description);
  }
  if (data.recurring !== undefined) updateData.recurring = data.recurring;
  if (data.expenseType !== undefined) {
    // Only set expenseType if type is expense, otherwise set to null
    const finalType = data.type !== undefined ? data.type : currentType;
    updateData.expenseType = finalType === "expense" ? (data.expenseType || null) : null;
  }
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: transaction, error } = await supabase
    .from("Transaction")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error updating transaction:", error);
    throw new Error(`Failed to update transaction: ${error.message || JSON.stringify(error)}`);
  }

  if (!transaction) {
    throw new Error("Transaction not found after update");
  }

  // Update category_learning if categoryId changed
  if (data.categoryId !== undefined) {
    // Get current transaction to compare
    const { data: currentTransaction } = await supabase
      .from("Transaction")
      .select("description, type, amount_numeric, userId")
      .eq("id", id)
      .single();
    
    if (currentTransaction) {
      const desc = decryptDescription(currentTransaction.description || transaction.description);
      const normalizedDesc = normalizeDescription(desc);
      const txAmount = currentTransaction.amount_numeric || decryptAmount(transaction.amount) || 0;
      const txType = transaction.type;
      
      if (data.categoryId) {
        await updateCategoryLearning(
          currentTransaction.userId || (transaction as any).userId,
          normalizedDesc,
          txType,
          data.categoryId,
          data.subcategoryId || null,
          txAmount
        );
      }
    }
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();

  // Return transaction with decrypted fields
  // Prefer amount_numeric if available, otherwise decrypt amount
  const finalAmount = transaction.amount_numeric !== null && transaction.amount_numeric !== undefined
    ? transaction.amount_numeric
    : decryptAmount(transaction.amount);
  
  return {
    ...transaction,
    amount: finalAmount,
    description: decryptDescription(transaction.description),
  };
}

export async function deleteTransaction(id: string) {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireTransactionOwnership(id);

  // Get transaction first
  const { data: transaction, error: fetchError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !transaction) {
    logger.error("Supabase error fetching transaction:", fetchError);
    throw new Error("Transaction not found");
  }

  const { error } = await supabase.from("Transaction").delete().eq("id", id);
  if (error) {
    logger.error("Supabase error deleting transaction:", error);
    throw new Error(`Failed to delete transaction: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();
}

export async function deleteMultipleTransactions(ids: string[]) {
  const supabase = await createServerClient();

  if (ids.length === 0) {
    return;
  }

  // Verify ownership for all transactions before deleting
  for (const id of ids) {
    await requireTransactionOwnership(id);
  }

  // Verify all transactions exist first
  const { data: transactions, error: fetchError } = await supabase
    .from("Transaction")
    .select("id")
    .in("id", ids);

  if (fetchError) {
    logger.error("Supabase error fetching transactions:", fetchError);
    throw new Error("Failed to verify transactions");
  }

  if (!transactions || transactions.length !== ids.length) {
    throw new Error("Some transactions were not found");
  }

  const { error } = await supabase.from("Transaction").delete().in("id", ids);
  if (error) {
    logger.error("Supabase error deleting transactions:", error);
    throw new Error(`Failed to delete transactions: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
  invalidateTransactionCaches();
}

export async function getTransactionsInternal(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    accountId?: string;
    type?: string;
    search?: string;
    recurring?: boolean;
    page?: number;
    limit?: number;
  },
  accessToken?: string,
  refreshToken?: string
) {
  const supabase = await createServerClient(accessToken, refreshToken);

  // IMPORTANT: Buscar transações SEM joins primeiro para evitar problemas de RLS
  // Quando fazemos select('*, account:Account(*)'), o Supabase aplica RLS em Account também
  // Se Account RLS bloquear, a transação não aparece mesmo que Transaction RLS permita
  // Solução: Buscar transações primeiro, depois buscar relacionamentos separadamente
  
  // For pagination, we need to get the count first
  // Create a count query to get total number of transactions
  let countQuery = supabase
    .from("Transaction")
    .select("*", { count: 'exact', head: true });
  
  let query = supabase
    .from("Transaction")
    .select("*")
    .order("date", { ascending: false });

  const log = logger.withPrefix("getTransactionsInternal");

  // Apply filters to both queries
  const applyFilters = (q: any) => {
    let filteredQuery = q;
    if (filters?.startDate) {
      filteredQuery = filteredQuery.gte("date", formatDateStart(filters.startDate));
    }
    if (filters?.endDate) {
      filteredQuery = filteredQuery.lte("date", formatDateEnd(filters.endDate));
    }
    if (filters?.categoryId) {
      filteredQuery = filteredQuery.eq("categoryId", filters.categoryId);
    }
    if (filters?.accountId) {
      filteredQuery = filteredQuery.eq("accountId", filters.accountId);
    }
    if (filters?.type) {
      if (filters.type === "transfer") {
        // Transfer transactions have either transferToId or transferFromId set
        filteredQuery = filteredQuery.or("transferToId.not.is.null,transferFromId.not.is.null");
      } else {
        filteredQuery = filteredQuery.eq("type", filters.type);
      }
    }
    if (filters?.recurring !== undefined) {
      filteredQuery = filteredQuery.eq("recurring", filters.recurring);
    }
    // Use description_search for search (much faster than decrypting everything)
    if (filters?.search) {
      const normalizedSearch = normalizeDescription(filters.search);
      // Use ILIKE for case-insensitive search on normalized description_search
      filteredQuery = filteredQuery.ilike("description_search", `%${normalizedSearch}%`);
    }
    return filteredQuery;
  };

  // Apply filters to both queries
  countQuery = applyFilters(countQuery);
  query = applyFilters(query);

  // Apply pagination if provided
  // Now that we use description_search, we can paginate in the database even with search
  if (filters?.page !== undefined && filters?.limit !== undefined) {
    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit)); // Limit max to 100
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  // Verificar se o usuário está autenticado antes de executar a query
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  
  // Se não estiver autenticado, retornar array vazio (não lançar erro)
  if (authError || !currentUser) {
    return { transactions: [], total: 0 };
  }

  // Execute count query and data query in parallel
  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    query
  ]);

  if (error) {
    logger.error("Supabase error fetching transactions:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId: currentUser?.id,
      queryFilters: filters,
    });
    throw new Error(`Failed to fetch transactions: ${error.message || JSON.stringify(error)}`);
  }

  if (!data || data.length === 0) {
    return { transactions: [], total: count || 0 };
  }

  // Buscar relacionamentos separadamente para evitar problemas de RLS com joins
  // Coletar IDs únicos de relacionamentos
  const accountIds = [...new Set(data.map((t: any) => t.accountId).filter(Boolean))];
  const categoryIds = [...new Set(data.map((t: any) => t.categoryId).filter(Boolean))];
  const subcategoryIds = [...new Set(data.map((t: any) => t.subcategoryId).filter(Boolean))];

  // Buscar todos os relacionamentos em paralelo para melhor performance
  const [accountsResult, categoriesResult, subcategoriesResult] = await Promise.all([
    accountIds.length > 0 
      ? supabase.from("Account").select("*").in("id", accountIds)
      : Promise.resolve({ data: null, error: null }),
    categoryIds.length > 0
      ? supabase.from("Category").select("*").in("id", categoryIds)
      : Promise.resolve({ data: null, error: null }),
    subcategoryIds.length > 0
      ? supabase.from("Subcategory").select("*").in("id", subcategoryIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Criar maps para acesso rápido
  const accountsMap = new Map();
  if (accountsResult.data) {
    accountsResult.data.forEach((acc: any) => {
      accountsMap.set(acc.id, acc);
    });
  }

  const categoriesMap = new Map();
  if (categoriesResult.data) {
    categoriesResult.data.forEach((cat: any) => {
      categoriesMap.set(cat.id, cat);
    });
  }

  const subcategoriesMap = new Map();
  if (subcategoriesResult.data) {
    subcategoriesResult.data.forEach((sub: any) => {
      subcategoriesMap.set(sub.id, sub);
    });
  }

  // Combine transactions with relationships
  // Use amount_numeric if available, otherwise decrypt amount
  // Decrypt description (description_search is only for search, not display)
  const { decryptDescription } = await import("@/lib/utils/transaction-encryption");
  
  let transactions = (data || []).map((tx: any) => {
    // Use amount_numeric if available, otherwise decrypt amount
    const amount = tx.amount_numeric !== null && tx.amount_numeric !== undefined
      ? tx.amount_numeric
      : decryptAmount(tx.amount);
    
    return {
      ...tx,
      amount: amount,
      description: decryptDescription(tx.description),
      account: accountsMap.get(tx.accountId) || null,
      category: categoriesMap.get(tx.categoryId) || null,
      subcategory: subcategoriesMap.get(tx.subcategoryId) || null,
    };
  });

  // Search is now done in the database using description_search, so no need to filter in memory
  // Pagination is also done in the database
  const paginatedTransactions = transactions;
  
  // Total count from database (search filtering is done in SQL)
  const totalCount = count || 0;

  return { 
    transactions: paginatedTransactions, 
    total: totalCount 
  };
}

export async function getTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: string;
  search?: string;
  recurring?: boolean;
  page?: number;
  limit?: number;
}) {
  // Get tokens from Supabase client directly (not from cookies)
  // This is more reliable because Supabase SSR manages cookies automatically
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  
  try {
    const supabase = await createServerClient();
    // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Only get session tokens if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
  } catch (error: any) {
      // If we can't get tokens (e.g., inside unstable_cache), continue without them
      logger.warn("Could not get tokens:", error?.message);
  }
  
  // Cache for 10 seconds if no search filter (searches should be real-time)
  // Cache is invalidated via revalidateTag('transactions') when transactions are created/updated/deleted
  // Shorter cache time ensures fresh data while maintaining performance
  if (!filters?.search) {
    const cacheKey = `transactions-${filters?.startDate?.toISOString()}-${filters?.endDate?.toISOString()}-${filters?.categoryId || 'all'}-${filters?.accountId || 'all'}-${filters?.type || 'all'}-${filters?.recurring || 'all'}`;
    return unstable_cache(
      async () => getTransactionsInternal(filters, accessToken, refreshToken),
      [cacheKey],
      { revalidate: 10, tags: ['transactions'] }
    )();
  }
  
  return getTransactionsInternal(filters, accessToken, refreshToken);
}

export async function getUpcomingTransactions(limit: number = 5) {
    const supabase = await createServerClient();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 15); // Look ahead 15 days
  endDate.setHours(23, 59, 59, 999); // Set to end of day to include all transactions on that day

  // Get all recurring transactions (both expenses and incomes)
  const { data: recurringTransactions, error } = await supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category!Transaction_categoryId_fkey(*),
      subcategory:Subcategory!Transaction_subcategoryId_fkey(id, name, logo)
    `)
    .eq("recurring", true)
    .order("date", { ascending: true });

  if (error) {
    logger.error("Supabase error fetching recurring transactions:", error);
    // Return empty array if there's an error
    return [];
  }

  if (!recurringTransactions || recurringTransactions.length === 0) {
    return [];
  }

  // Handle relations for recurring transactions and decrypt descriptions
  const transactions = (recurringTransactions || []).map((tx: any) => {
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
    
    return {
      ...tx,
      description: decryptDescription(tx.description),
      amount: decryptAmount(tx.amount),
      account: account || null,
      category: category || null,
      subcategory: subcategory || null,
    };
  });

  // Calculate upcoming occurrences for recurring transactions
  const upcoming: Array<{
    id: string;
    date: Date;
    type: string;
    amount: number;
    description?: string;
    account?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string } | null;
    originalDate: Date;
    isDebtPayment?: boolean;
  }> = [];

  for (const tx of transactions) {
    const originalDate = new Date(tx.date);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Calculate the next occurrence date based on the original date's day of month
    const originalDay = originalDate.getDate();
    
    // Start with this month, same day
    let nextDate = new Date(today.getFullYear(), today.getMonth(), originalDay);
    nextDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Handle edge case: if the original day doesn't exist in current month (e.g., Jan 31 -> Feb)
    // Use the last day of the current month
    if (nextDate.getDate() !== originalDay) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      nextDate.setHours(0, 0, 0, 0);
    }

    // If the next occurrence is in the past, move to next month
    if (nextDate < today) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, originalDay);
      nextDate.setHours(0, 0, 0, 0);
      // Handle edge case again for next month
      if (nextDate.getDate() !== originalDay) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        nextDate.setHours(0, 0, 0, 0);
      }
    }

    // Only include if it's within the next 15 days
    // Compare dates properly - endDate is already normalized to end of day
    if (nextDate <= endDate) {
      upcoming.push({
        id: tx.id,
        date: nextDate,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        account: tx.account,
        category: tx.category,
        subcategory: tx.subcategory,
        originalDate: originalDate,
        isDebtPayment: false,
      });
    }
  }

  // Get debts and calculate upcoming debt payments
  try {
    const debts = await getDebts();
    console.log(`[getUpcomingTransactions] Found ${debts.length} debts, endDate: ${endDate.toISOString()}, now: ${now.toISOString()}`);
    
    for (const debt of debts) {
      // Skip if debt is paid off or paused
      if (debt.isPaidOff || debt.isPaused || debt.currentBalance <= 0) {
        console.log(`[getUpcomingTransactions] Skipping debt ${debt.name}: isPaidOff=${debt.isPaidOff}, isPaused=${debt.isPaused}, currentBalance=${debt.currentBalance}`);
        continue;
      }

      // Convert debt to DebtForCalculation format
      const debtForCalculation: DebtForCalculation = {
        id: debt.id,
        name: debt.name,
        initialAmount: debt.initialAmount,
        downPayment: debt.downPayment,
        currentBalance: debt.currentBalance,
        interestRate: debt.interestRate,
        totalMonths: debt.totalMonths,
        firstPaymentDate: debt.firstPaymentDate,
        monthlyPayment: debt.monthlyPayment,
        paymentFrequency: debt.paymentFrequency,
        paymentAmount: debt.paymentAmount,
        principalPaid: debt.principalPaid,
        interestPaid: debt.interestPaid,
        additionalContributions: debt.additionalContributions,
        additionalContributionAmount: debt.additionalContributionAmount,
        priority: debt.priority,
        isPaused: debt.isPaused,
        isPaidOff: debt.isPaidOff,
        description: debt.description,
      };

      // Calculate next payment dates for this debt
      const debtPayments = calculateNextPaymentDates(
        debtForCalculation,
        now,
        endDate
      );
      console.log(`[getUpcomingTransactions] Debt ${debt.name} (firstPaymentDate: ${debt.firstPaymentDate}, frequency: ${debt.paymentFrequency}) has ${debtPayments.length} payments in next 15 days`);

      // Get account information if accountId is set
      let account = null;
      if (debt.accountId) {
        const { data: accountData } = await supabase
          .from("Account")
          .select("id, name")
          .eq("id", debt.accountId)
          .single();
        
        if (accountData) {
          account = {
            id: accountData.id,
            name: accountData.name,
          };
        }
      }

      // Get category mapping for the debt
      let category = null;
      let subcategory = null;
      try {
        const categoryMapping = await getDebtCategoryMapping(debt.loanType);
        if (categoryMapping) {
          const { data: categoryData } = await supabase
            .from("Category")
            .select("id, name")
            .eq("id", categoryMapping.categoryId)
            .single();
          
          if (categoryData) {
            category = {
              id: categoryData.id,
              name: categoryData.name,
            };
          }

          if (categoryMapping.subcategoryId) {
            const { data: subcategoryData } = await supabase
              .from("Subcategory")
              .select("id, name")
              .eq("id", categoryMapping.subcategoryId)
              .single();
            
            if (subcategoryData) {
              subcategory = {
                id: subcategoryData.id,
                name: subcategoryData.name,
              };
            }
          }
        } else {
          // If category mapping is null, log a warning but continue without category
          logger.warn(`No category mapping found for debt ${debt.id} with loan type ${debt.loanType}`);
        }
      } catch (error) {
        // Log error but don't break the function - continue without category
        logger.error(`Error fetching category mapping for debt ${debt.id}:`, error);
      }

      // Add debt payments to upcoming list
      for (const payment of debtPayments) {
        upcoming.push({
          id: `debt-${debt.id}-${payment.date.toISOString()}`,
          date: payment.date,
          type: "expense",
          amount: payment.amount,
          description: `Payment for ${debt.name}`,
          account: account,
          category: category,
          subcategory: subcategory,
          originalDate: payment.date,
          isDebtPayment: true,
        });
      }
    }
  } catch (error) {
    logger.error("Error fetching debt payments:", error);
    // Continue even if debt payments fail
  }

  // Sort by date and limit
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  console.log(`[getUpcomingTransactions] Returning ${upcoming.length} upcoming transactions (recurring: ${upcoming.filter(t => !t.isDebtPayment).length}, debts: ${upcoming.filter(t => t.isDebtPayment).length})`);
  // Return all transactions within the 15-day window, not just the limit
  // The limit is applied by the caller if needed
  return upcoming;
}

export async function getAccountBalance(accountId: string) {
    const supabase = await createServerClient();

  // Get account to retrieve initialBalance
  const { data: account } = await supabase
    .from("Account")
    .select("initialBalance")
    .eq("id", accountId)
    .single();

  const initialBalance = (account?.initialBalance as number) ?? 0;

  // Only include transactions with date <= today (exclude future transactions)
  // Use a consistent date comparison to avoid timezone issues
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // Create date for end of today in local timezone, then convert to ISO for query
  const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);

  const { data: transactions, error } = await supabase
    .from("Transaction")
    .select("type, amount, date")
    .eq("accountId", accountId)
    .lte("date", todayEnd.toISOString());

  if (error) {
    return initialBalance;
  }

  // Compare dates by year, month, day only to avoid timezone issues
  const todayDate = new Date(todayYear, todayMonth, todayDay);

  let balance = initialBalance;
  for (const tx of transactions || []) {
    // Parse transaction date and compare only date part (ignore time)
    const txDateObj = new Date(tx.date);
    const txYear = txDateObj.getFullYear();
    const txMonth = txDateObj.getMonth();
    const txDay = txDateObj.getDate();
    const txDate = new Date(txYear, txMonth, txDay);
    
    // Skip future transactions (date > today)
    if (txDate > todayDate) {
      continue;
    }
    
    // Decrypt amount before using in calculation
    const amount = decryptAmount(tx.amount);
    
    // Skip transaction if amount is invalid (null, NaN, or unreasonably large)
    if (amount === null || isNaN(amount) || !isFinite(amount)) {
      logger.warn('Skipping transaction with invalid amount:', {
        accountId,
        amount: tx.amount,
        decryptedAmount: amount,
      });
      continue;
    }
    
    if (tx.type === "income") {
      balance += amount;
    } else if (tx.type === "expense") {
      balance -= amount;
    }
  }

  return balance;
}
