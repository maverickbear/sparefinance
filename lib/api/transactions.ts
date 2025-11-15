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
import { suggestCategory } from "@/lib/api/category-learning";
import { logger } from "@/lib/utils/logger";
import { encryptDescription, decryptDescription, encryptAmount, decryptAmount } from "@/lib/utils/transaction-encryption";

export async function createTransaction(data: TransactionFormData) {
    const supabase = await createServerClient();

  // Get current user and validate transaction limit
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }
  
  const userId = user.id;

  // Check transaction limit before creating
  const limitGuard = await guardTransactionLimit(userId, data.date instanceof Date ? data.date : new Date(data.date));
  await throwIfNotAllowed(limitGuard);

  // Ensure date is a Date object
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  
  // Format date for PostgreSQL timestamp(3) without time zone
  // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
  // This ensures the date is saved exactly as the user selected
  const formatDate = formatDateOnly;

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
  const transactionDate = formatDate(date);

  // Use provided category if available, otherwise null (don't auto-categorize even with high confidence)
  // We'll always show suggestions for user approval/rejection
  // For transfers, don't use categories
  const finalCategoryId = data.type === "transfer" ? null : (data.categoryId || null);
  const finalSubcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);

  // For transfers, create two linked transactions: one outgoing and one incoming
  if (data.type === "transfer" && data.toAccountId) {
    const outgoingId = id;
    const incomingId = crypto.randomUUID();

    // Encrypt description and amount for outgoing transaction
    const encryptedOutgoingDescription = encryptDescription(data.description || `Transfer to account`);
    const encryptedAmount = encryptAmount(data.amount);

    // Create outgoing transaction (from source account)
    const { data: outgoingTransaction, error: outgoingError } = await supabase
      .from("Transaction")
      .insert({
        id: outgoingId,
        date: transactionDate,
        type: "expense", // Outgoing is an expense from source account
        amount: encryptedAmount,
        accountId: data.accountId,
        userId: user.id,
        categoryId: null,
        subcategoryId: null,
        description: encryptedOutgoingDescription,
        recurring: data.recurring ?? false,
        transferToId: incomingId, // Link to incoming transaction
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (outgoingError) {
      logger.error("Supabase error creating outgoing transfer transaction:", {
        message: outgoingError.message,
        details: outgoingError.details,
        hint: outgoingError.hint,
        code: outgoingError.code,
      });
      throw new Error(`Failed to create transfer transaction: ${outgoingError.message || JSON.stringify(outgoingError)}`);
    }

    // Encrypt description and amount for incoming transaction
    const encryptedIncomingDescription = encryptDescription(data.description || `Transfer from account`);
    const encryptedIncomingAmount = encryptAmount(data.amount);

    // Create incoming transaction (to destination account)
    const { data: incomingTransaction, error: incomingError } = await supabase
      .from("Transaction")
      .insert({
        id: incomingId,
        date: transactionDate,
        type: "income", // Incoming is an income to destination account
        amount: encryptedIncomingAmount,
        accountId: data.toAccountId,
        userId: user.id,
        categoryId: null,
        subcategoryId: null,
        description: encryptedIncomingDescription,
        recurring: data.recurring ?? false,
        transferFromId: outgoingId, // Link to outgoing transaction
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (incomingError) {
      // If incoming transaction fails, try to delete the outgoing one
      await supabase.from("Transaction").delete().eq("id", outgoingId);
      logger.error("Supabase error creating incoming transfer transaction:", {
        message: incomingError.message,
        details: incomingError.details,
        hint: incomingError.hint,
        code: incomingError.code,
      });
      throw new Error(`Failed to create transfer transaction: ${incomingError.message || JSON.stringify(incomingError)}`);
    }

    // Invalidate cache to ensure dashboard shows updated data
    revalidateTag('transactions', 'max');

    // Return the outgoing transaction as the main one
    return outgoingTransaction;
  }

  // Encrypt description and amount before saving
  const encryptedDescription = encryptDescription(data.description || null);
  const encryptedAmount = encryptAmount(data.amount);

  // Regular transaction (expense or income)
  const { data: transaction, error } = await supabase
    .from("Transaction")
      .insert({
        id,
        date: transactionDate,
        type: data.type,
        amount: encryptedAmount,
        accountId: data.accountId,
        userId: user.id, // Add userId directly to transaction
        categoryId: finalCategoryId,
        subcategoryId: finalSubcategoryId,
        description: encryptedDescription,
        recurring: data.recurring ?? false,
        expenseType: data.type === "expense" ? (data.expenseType || null) : null,
        createdAt: now,
        updatedAt: now,
      })
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating transaction:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to create transaction: ${error.message || JSON.stringify(error)}`);
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

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('transactions', 'max');
  revalidateTag('dashboard', 'max');

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
    // Use formatDateOnly to save only the date (00:00:00) in user's local timezone
    updateData.date = formatDateOnly(date);
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = encryptAmount(data.amount);
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId || null;
  if (data.description !== undefined) updateData.description = encryptDescription(data.description || null);
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

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('transactions', 'max');
  revalidateTag('dashboard', 'max');

  // Decrypt amount and description before returning
  return {
    ...transaction,
    amount: decryptAmount(transaction.amount),
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
  revalidateTag('transactions', 'max');
  revalidateTag('dashboard', 'max');
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
  revalidateTag('transactions', 'max');
  revalidateTag('dashboard', 'max');
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
  
  // Log the date filters being applied (only in development)
  if (filters?.startDate || filters?.endDate) {
    log.debug("Date filters:", {
      startDate: filters.startDate ? formatDateStart(filters.startDate) : undefined,
      endDate: filters.endDate ? formatDateEnd(filters.endDate) : undefined,
    });
  }

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
      filteredQuery = filteredQuery.eq("type", filters.type);
    }
    if (filters?.recurring !== undefined) {
      filteredQuery = filteredQuery.eq("recurring", filters.recurring);
    }
    return filteredQuery;
  };

  // Apply filters to both queries
  countQuery = applyFilters(countQuery);
  query = applyFilters(query);

  // Apply pagination if provided
  // Note: If search is active, we need to load all results first, then filter and paginate in memory
  // This is because descriptions are encrypted and we can't search in the database
  if (filters?.page !== undefined && filters?.limit !== undefined && !filters?.search) {
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
    log.debug("User not authenticated");
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

  // Log resumido sobre o resultado (apenas em desenvolvimento)
  if (data && data.length > 0) {
    log.debug("Transactions found:", {
      count: data.length,
      total: count || 0,
      types: [...new Set(data.map((t: any) => t.type))],
    });
  }

  if (!data || data.length === 0) {
    log.debug("No transactions found");
    return { transactions: [], total: count || 0 };
  }

  // Log resumido (apenas em desenvolvimento)
  log.debug("Transactions loaded:", {
    totalCount: data.length,
    incomeCount: data.filter((t: any) => t.type === "income").length,
    expenseCount: data.filter((t: any) => t.type === "expense").length,
  });

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

  // Combinar transações com relacionamentos e descriptografar descriptions e amounts
  let transactions = (data || []).map((tx: any) => ({
      ...tx,
      description: decryptDescription(tx.description),
      amount: decryptAmount(tx.amount),
      account: accountsMap.get(tx.accountId) || null,
      category: categoriesMap.get(tx.categoryId) || null,
      subcategory: subcategoriesMap.get(tx.subcategoryId) || null,
    }));

  // Apply search filter in memory after decrypting descriptions
  // Note: When search is applied, we need to filter all results, so pagination happens after search
  // This means if search is used, we need to load all matching transactions first
  // For better performance with search, consider implementing full-text search in the database
  let filteredTransactions = transactions;
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    filteredTransactions = transactions.filter((tx: any) => {
      const description = tx.description || '';
      return description.toLowerCase().includes(searchLower);
    });
  }

  // Apply pagination after search if search was used
  let paginatedTransactions = filteredTransactions;
  if (filters?.search && filters?.page !== undefined && filters?.limit !== undefined) {
    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit)); // Limit max to 100
    const from = (page - 1) * limit;
    const to = from + limit;
    paginatedTransactions = filteredTransactions.slice(from, to);
  }

  // If search was applied, the total count needs to reflect the filtered results
  // Since we can't get the count of filtered results from the database (descriptions are encrypted),
  // we return the filtered count as the total when search is active
  const totalCount = filters?.search ? filteredTransactions.length : (count || 0);

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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
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
  endDate.setMonth(endDate.getMonth() + 1); // Look ahead 1 month

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
    
    // Handle edge case: if the original day doesn't exist in current month (e.g., Jan 31 -> Feb)
    // Use the last day of the current month
    if (nextDate.getDate() !== originalDay) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // If the next occurrence is in the past, move to next month
    if (nextDate < today) {
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, originalDay);
      // Handle edge case again for next month
      if (nextDate.getDate() !== originalDay) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      }
    }

    // Only include if it's within the next month
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
    
    for (const debt of debts) {
      // Skip if debt is paid off or paused
      if (debt.isPaidOff || debt.isPaused || debt.currentBalance <= 0) {
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
  return upcoming.slice(0, limit);
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
