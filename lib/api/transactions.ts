"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { TransactionFormData } from "@/lib/validations/transaction";
import { formatTimestamp, formatDateStart, formatDateEnd, getCurrentTimestamp } from "@/lib/utils/timestamp";
import { getDebts } from "@/lib/api/debts";
import { calculateNextPaymentDates, type DebtForCalculation } from "@/lib/utils/debts";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { guardTransactionLimit, getCurrentUserId, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { requireTransactionOwnership } from "@/lib/utils/security";
import { suggestCategory } from "@/lib/api/category-learning";

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
  
  // Format date for PostgreSQL timestamp(3) without time zone: YYYY-MM-DD HH:MM:SS
  const formatDate = formatTimestamp;

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
      console.log('Category suggestion for manual transaction:', {
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
      console.error('Error getting category suggestion:', error);
      // Continue without suggestion if there's an error
    }
  }

  // Generate UUID for transaction
  const id = crypto.randomUUID();
  const transactionDate = formatDate(date);

  // Use provided category if available, otherwise null (don't auto-categorize even with high confidence)
  // We'll always show suggestions for user approval/rejection
  const finalCategoryId = data.categoryId || null;
  const finalSubcategoryId = data.subcategoryId || null;

  const { data: transaction, error } = await supabase
    .from("Transaction")
      .insert({
        id,
        date: transactionDate,
        type: data.type,
        amount: data.amount,
        accountId: data.accountId,
        userId: user.id, // Add userId directly to transaction
        categoryId: finalCategoryId,
        subcategoryId: finalSubcategoryId,
        description: data.description || null,
        recurring: data.recurring ?? false,
        createdAt: now,
        updatedAt: now,
      })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating transaction:", {
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
      console.error('Error updating transaction with suggestion:', updateError);
    } else {
      console.log('Transaction updated with category suggestion:', {
        transactionId: id,
        suggestedCategoryId: categorySuggestion.categoryId,
        confidence: categorySuggestion.confidence,
        matchCount: categorySuggestion.matchCount,
      });
    }
  }

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('transactions', 'page');

  return transaction;
}

export async function updateTransaction(id: string, data: Partial<TransactionFormData>) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireTransactionOwnership(id);

  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date value");
    }
    updateData.date = date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId || null;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.recurring !== undefined) updateData.recurring = data.recurring;
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: transaction, error } = await supabase
    .from("Transaction")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating transaction:", error);
    throw new Error(`Failed to update transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
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
    console.error("Supabase error fetching transaction:", fetchError);
    throw new Error("Transaction not found");
  }

  const { error } = await supabase.from("Transaction").delete().eq("id", id);
  if (error) {
    console.error("Supabase error deleting transaction:", error);
    throw new Error(`Failed to delete transaction: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('transactions', 'page');
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
  },
  accessToken?: string,
  refreshToken?: string
) {
    const supabase = await createServerClient(accessToken, refreshToken);

  // IMPORTANT: Buscar transações SEM joins primeiro para evitar problemas de RLS
  // Quando fazemos select('*, account:Account(*)'), o Supabase aplica RLS em Account também
  // Se Account RLS bloquear, a transação não aparece mesmo que Transaction RLS permita
  // Solução: Buscar transações primeiro, depois buscar relacionamentos separadamente
  let query = supabase
    .from("Transaction")
    .select("*")
    .order("date", { ascending: false });

  // Log the date filters being applied
  if (filters?.startDate || filters?.endDate) {
    console.log("🔍 [getTransactionsInternal] Applying date filters:", {
      startDate: filters.startDate ? {
        original: filters.startDate.toISOString(),
        formatted: formatDateStart(filters.startDate),
      } : undefined,
      endDate: filters.endDate ? {
        original: filters.endDate.toISOString(),
        formatted: formatDateEnd(filters.endDate),
      } : undefined,
    });
  }

  if (filters?.startDate) {
    query = query.gte("date", formatDateStart(filters.startDate));
  }

  if (filters?.endDate) {
    query = query.lte("date", formatDateEnd(filters.endDate));
  }

  if (filters?.categoryId) {
    query = query.eq("categoryId", filters.categoryId);
  }

  if (filters?.accountId) {
    query = query.eq("accountId", filters.accountId);
  }

  if (filters?.type) {
    console.log("🔍 [getTransactionsInternal] Applying type filter:", {
      type: filters.type,
    });
    query = query.eq("type", filters.type);
  }

  if (filters?.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  if (filters?.recurring !== undefined) {
    query = query.eq("recurring", filters.recurring);
  }

  // Log the final query being executed
  console.log("🔍 [getTransactionsInternal] Executing query with filters:", {
    hasStartDate: !!filters?.startDate,
    hasEndDate: !!filters?.endDate,
    type: filters?.type,
    categoryId: filters?.categoryId,
    accountId: filters?.accountId,
  });

  // Verificar se o usuário está autenticado antes de executar a query
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  
  // Se não estiver autenticado, retornar array vazio (não lançar erro)
  if (authError || !currentUser) {
    console.log("🔍 [getTransactionsInternal] User not authenticated:", {
      authError: authError?.message,
      hasUser: !!currentUser,
    });
    return [];
  }

  console.log("🔍 [getTransactionsInternal] Authentication check:", {
    hasUser: !!currentUser,
    userId: currentUser?.id,
  });

  const { data, error } = await query;

  if (error) {
    console.error("Supabase error fetching transactions:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId: currentUser?.id,
    });
    throw new Error(`Failed to fetch transactions: ${error.message || JSON.stringify(error)}`);
  }

  // Log detalhado sobre o resultado
  if (data && data.length > 0) {
    console.log("🔍 [getTransactionsInternal] Transactions found:", {
      count: data.length,
      sampleTransaction: data[0] ? {
        id: data[0].id,
        userId: data[0].userId,
        accountId: data[0].accountId,
        type: data[0].type,
        amount: data[0].amount,
        date: data[0].date,
      } : null,
      currentUserId: currentUser?.id,
      userIdMatch: data[0]?.userId === currentUser?.id,
    });
  }

  if (!data || data.length === 0) {
    // Only log in development to reduce noise in production
    if (process.env.NODE_ENV === "development") {
      // Log the actual formatted dates being used in the query
      const logFilters = filters ? {
        ...filters,
        startDate: filters.startDate ? formatDateStart(filters.startDate) : undefined,
        endDate: filters.endDate ? formatDateEnd(filters.endDate) : undefined,
      } : filters;
      console.log("🔍 [getTransactionsInternal] No transactions found with filters:", logFilters);
      
      // Check if there are ANY transactions in the database (without date filters)
      // This helps us understand if the problem is with date filtering or if there are no transactions at all
      // Also check if userId column exists
        // IMPORTANT: Test RLS by checking auth.uid() directly
        const { data: { user: testUser } } = await supabase.auth.getUser();
        console.log("🔍 [getTransactionsInternal] RLS Test - auth.uid() check:", {
          currentUserId: currentUser?.id,
          testUserId: testUser?.id,
          userIdsMatch: currentUser?.id === testUser?.id,
        });

      const { data: allTransactions, error: allError } = await supabase
        .from("Transaction")
        .select("id, date, type, amount, accountId, userId")
        .limit(10)
        .order("date", { ascending: false });
      
      if (allError) {
        console.error("❌ [getTransactionsInternal] Error checking for any transactions:", allError);
      } else {
        console.log("🔍 [getTransactionsInternal] Sample of ALL transactions in DB (first 10):", {
          totalFound: allTransactions?.length || 0,
          transactions: allTransactions?.map((t: any) => ({
            id: t.id,
            date: t.date,
            dateType: typeof t.date,
            type: t.type,
            amount: t.amount,
            accountId: t.accountId,
            userId: t.userId, // Check if userId column exists and is populated
            hasUserId: t.userId !== null && t.userId !== undefined,
          })) || [],
          dateRange: allTransactions && allTransactions.length > 0 ? {
            oldest: allTransactions[allTransactions.length - 1]?.date,
            newest: allTransactions[0]?.date,
          } : null,
        });

        // Check if user has accounts and if transactions belong to those accounts
        if (allTransactions && allTransactions.length > 0) {
          const { data: userAccounts, error: accountsError } = await supabase
            .from("Account")
            .select("id, userId, name")
            .limit(10);
          
          // Get current user ID
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          // Check AccountOwner for transaction accounts
          const transactionAccountIds = [...new Set(allTransactions.map((t: any) => t.accountId))];
          const { data: accountOwners, error: ownersError } = await supabase
            .from("AccountOwner")
            .select("accountId, ownerId")
            .in("accountId", transactionAccountIds);
          
          console.log("🔍 [getTransactionsInternal] User accounts check:", {
            currentUserId: currentUser?.id,
            accountsFound: userAccounts?.length || 0,
            accounts: userAccounts || [],
            accountsError: accountsError,
            transactionAccountIds: transactionAccountIds,
            transactionAccounts: allTransactions.map((t: any) => ({
              transactionId: t.id,
              accountId: t.accountId,
              type: t.type,
              amount: t.amount,
            })),
            matchingAccounts: userAccounts?.filter((acc: any) => 
              allTransactions.some((t: any) => t.accountId === acc.id)
            ) || [],
            accountOwners: accountOwners || [],
            ownersError: ownersError,
            accountsBelongingToUser: userAccounts?.filter((acc: any) => 
              acc.userId === currentUser?.id
            ) || [],
            accountsWithAccountOwner: accountOwners?.filter((ao: any) => 
              ao.ownerId === currentUser?.id
            ) || [],
          });
        }
      }
    }
    return [];
  }

  // Log detailed transaction information for debugging Monthly Income issue
  console.log("🔍 [getTransactionsInternal] Found transactions:", {
    totalCount: data.length,
    filters: filters ? {
      startDate: filters.startDate ? formatDateStart(filters.startDate) : undefined,
      endDate: filters.endDate ? formatDateEnd(filters.endDate) : undefined,
      type: filters.type,
    } : "no filters",
    transactionTypes: [...new Set(data.map((t: any) => t.type))],
    incomeCount: data.filter((t: any) => t.type === "income").length,
    expenseCount: data.filter((t: any) => t.type === "expense").length,
    incomeTransactions: data.filter((t: any) => t.type === "income").map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      amountType: typeof t.amount,
      date: t.date,
      description: t.description,
    })),
    incomeTotal: data.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => {
      const amount = Number(t.amount) || 0;
      return sum + amount;
    }, 0),
    sampleTransaction: data[0] ? {
      id: data[0].id,
      type: data[0].type,
      amount: data[0].amount,
      amountType: typeof data[0].amount,
      date: data[0].date,
    } : null,
  });

  // Buscar relacionamentos separadamente para evitar problemas de RLS com joins
  // Coletar IDs únicos de relacionamentos
  const accountIds = [...new Set(data.map((t: any) => t.accountId).filter(Boolean))];
  const categoryIds = [...new Set(data.map((t: any) => t.categoryId).filter(Boolean))];
  const subcategoryIds = [...new Set(data.map((t: any) => t.subcategoryId).filter(Boolean))];

  // Buscar contas separadamente
  const accountsMap = new Map();
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("Account")
      .select("*")
      .in("id", accountIds);
    
    if (accounts) {
      accounts.forEach((acc: any) => {
        accountsMap.set(acc.id, acc);
      });
    }
    }

  // Buscar categorias separadamente
  const categoriesMap = new Map();
  if (categoryIds.length > 0) {
    const { data: categories } = await supabase
      .from("Category")
      .select("*")
      .in("id", categoryIds);
    
    if (categories) {
      categories.forEach((cat: any) => {
        categoriesMap.set(cat.id, cat);
      });
    }
    }

  // Buscar subcategorias separadamente
  const subcategoriesMap = new Map();
  if (subcategoryIds.length > 0) {
    const { data: subcategories } = await supabase
      .from("Subcategory")
      .select("*")
      .in("id", subcategoryIds);
    
    if (subcategories) {
      subcategories.forEach((sub: any) => {
        subcategoriesMap.set(sub.id, sub);
      });
    }
  }

  // Combinar transações com relacionamentos
  const transactions = (data || []).map((tx: any) => ({
      ...tx,
    account: accountsMap.get(tx.accountId) || null,
    category: categoriesMap.get(tx.categoryId) || null,
    subcategory: subcategoriesMap.get(tx.subcategoryId) || null,
  }));

  return transactions;
}

export async function getTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: string;
  search?: string;
  recurring?: boolean;
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
    
    // Log token availability (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 [getTransactions] Token check:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length,
        refreshTokenLength: refreshToken?.length,
        hasSession: !!session,
      });
    }
  } catch (error: any) {
    // If we can't get tokens (e.g., inside unstable_cache), continue without them
    console.warn("⚠️ [getTransactions] Could not get tokens:", error?.message);
  }
  
  // Cache for 30 seconds if no search filter (searches should be real-time)
  if (!filters?.search) {
    const cacheKey = `transactions-${filters?.startDate?.toISOString()}-${filters?.endDate?.toISOString()}-${filters?.categoryId || 'all'}-${filters?.accountId || 'all'}-${filters?.type || 'all'}-${filters?.recurring || 'all'}`;
    return unstable_cache(
      async () => getTransactionsInternal(filters, accessToken, refreshToken),
      [cacheKey],
      { revalidate: 30, tags: ['transactions'] }
    )();
  }
  
  return getTransactionsInternal(filters, accessToken, refreshToken);
}

export async function getUpcomingTransactions(limit: number = 5) {
    const supabase = await createServerClient();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1); // Look ahead 1 month

  // Get all recurring transactions (without joins to avoid RLS issues)
  const { data: recurringTransactions, error } = await supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category!Transaction_categoryId_fkey(*),
      subcategory:Subcategory!Transaction_subcategoryId_fkey(*)
    `)
    .eq("recurring", true)
    .order("date", { ascending: true });

  if (error) {
    console.error("Supabase error fetching recurring transactions:", error);
    // Return empty array if there's an error
    return [];
  }

  if (!recurringTransactions || recurringTransactions.length === 0) {
    return [];
  }

  // Handle relations for recurring transactions
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
        }
      } catch (error) {
        console.error(`Error fetching category mapping for debt ${debt.id}:`, error);
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
    console.error("Error fetching debt payments:", error);
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
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  const { data: transactions, error } = await supabase
    .from("Transaction")
    .select("type, amount, date")
    .eq("accountId", accountId)
    .lte("date", today.toISOString());

  if (error) {
    return initialBalance;
  }

  // Double-check: only process transactions with date <= today
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let balance = initialBalance;
  for (const tx of transactions || []) {
    // Skip future transactions
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    if (txDate > todayDate) {
      continue;
    }
    
    if (tx.type === "income") {
      balance += (Number(tx.amount) || 0);
    } else if (tx.type === "expense") {
      balance -= (Number(tx.amount) || 0);
    }
  }

  return balance;
}
