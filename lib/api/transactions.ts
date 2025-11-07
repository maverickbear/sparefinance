"use server";

import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { TransactionFormData } from "@/lib/validations/transaction";
import { formatTimestamp, formatDateStart, formatDateEnd, getCurrentTimestamp } from "@/lib/utils/timestamp";
import { getDebts } from "@/lib/api/debts";
import { calculateNextPaymentDates, type DebtForCalculation } from "@/lib/utils/debts";
import { getDebtCategoryMapping } from "@/lib/utils/debt-categories";
import { guardTransactionLimit, getCurrentUserId, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function createTransaction(data: TransactionFormData) {
    const supabase = await createServerClient();

  // Get current user and validate transaction limit
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Check transaction limit before creating
  const limitGuard = await guardTransactionLimit(userId, data.date instanceof Date ? data.date : new Date(data.date));
  await throwIfNotAllowed(limitGuard);

  if (data.type === "transfer" && !data.transferToId) {
    throw new Error("Transfer destination is required");
  }

  // Ensure date is a Date object
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  
  // Format date for PostgreSQL timestamp(3) without time zone: YYYY-MM-DD HH:MM:SS
  const formatDate = formatTimestamp;

  if (data.type === "transfer") {
    // Generate UUIDs for transactions
    const outgoingId = crypto.randomUUID();
    const incomingId = crypto.randomUUID();
    const transferDate = formatDate(date);

    // Create outgoing transaction
    const { data: outgoing, error: outgoingError } = await supabase
      .from("Transaction")
      .insert({
        id: outgoingId,
        date: transferDate,
        type: "transfer",
        amount: data.amount,
        accountId: data.accountId,
        description: data.description || null,
        transferToId: data.transferToId!,
        recurring: data.recurring ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (outgoingError || !outgoing) {
      console.error("Supabase error creating outgoing transaction:", outgoingError);
      throw new Error(`Failed to create outgoing transaction: ${outgoingError?.message || JSON.stringify(outgoingError)}`);
    }

    // Create incoming transaction
    const { data: incoming, error: incomingError } = await supabase
      .from("Transaction")
      .insert({
        id: incomingId,
        date: transferDate,
        type: "transfer",
        amount: data.amount,
        accountId: data.transferToId!,
        description: data.description || null,
        transferFromId: outgoing.id,
        transferToId: null,
        recurring: data.recurring ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (incomingError || !incoming) {
      console.error("Supabase error creating incoming transaction:", incomingError);
      throw new Error(`Failed to create incoming transaction: ${incomingError?.message || JSON.stringify(incomingError)}`);
    }

    return { outgoing, incoming };
  }

  // Generate UUID for transaction
  const id = crypto.randomUUID();
  const transactionDate = formatDate(date);

  const { data: transaction, error } = await supabase
    .from("Transaction")
      .insert({
        id,
        date: transactionDate,
        type: data.type,
        amount: data.amount,
        accountId: data.accountId,
        categoryId: data.categoryId || null,
        subcategoryId: data.subcategoryId || null,
        description: data.description || null,
        tags: JSON.stringify(data.tags || []),
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

  return transaction;
}

export async function updateTransaction(id: string, data: Partial<TransactionFormData>) {
    const supabase = await createServerClient();

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
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags || []);
  if (data.recurring !== undefined) updateData.recurring = data.recurring;
  if (data.transferToId !== undefined) updateData.transferToId = data.transferToId || null;
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

  try {
    if (transaction.transferFromId) {
      // Delete the linked transfer transaction
      await supabase.from("Transaction").delete().eq("id", transaction.transferFromId);
      await supabase.from("Transaction").delete().eq("transferFromId", transaction.transferFromId);
    } else if (transaction.transferToId) {
      // Delete the outgoing transfer
      await supabase.from("Transaction").delete().eq("id", id);
      await supabase.from("Transaction").delete().eq("transferToId", transaction.transferToId);
    } else {
      const { error } = await supabase.from("Transaction").delete().eq("id", id);
      if (error) {
        console.error("Supabase error deleting transaction:", error);
        throw new Error(`Failed to delete transaction: ${error.message || JSON.stringify(error)}`);
      }
    }
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw error;
  }
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

  let query = supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category(*),
      subcategory:Subcategory(*)
    `)
    .order("date", { ascending: false });

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
    query = query.eq("type", filters.type);
  }

  if (filters?.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  if (filters?.recurring !== undefined) {
    query = query.eq("recurring", filters.recurring);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase error fetching transactions:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to fetch transactions: ${error.message || JSON.stringify(error)}`);
  }

  if (!data || data.length === 0) {
    // Only log in development to reduce noise in production
    if (process.env.NODE_ENV === "development") {
      console.log("No transactions found with filters:", filters);
    }
    return [];
  }

  // Only log in development to reduce noise in production
  if (process.env.NODE_ENV === "development") {
    console.log(`Found ${data.length} transactions from Supabase`);
  }

  // Supabase returns relations differently depending on the relationship type
  // For one-to-many or many-to-one, it can return as object or array
  const transactions = (data || []).map((tx: any) => {
    // Handle account relation
    let account = null;
    if (tx.account) {
      account = Array.isArray(tx.account) ? (tx.account.length > 0 ? tx.account[0] : null) : tx.account;
    }

    // Handle category relation
    let category = null;
    if (tx.category) {
      category = Array.isArray(tx.category) ? (tx.category.length > 0 ? tx.category[0] : null) : tx.category;
    }

    // Handle subcategory relation
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
  // Get tokens from cookies outside of cached function
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;
  
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

  // Get all recurring transactions
  const { data: recurringTransactions, error } = await supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category(*),
      subcategory:Subcategory(*)
    `)
    .eq("recurring", true)
    .order("date", { ascending: true });

  if (error) {
    console.error("Supabase error fetching recurring transactions:", error);
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
    .select("type, amount, transferToId, transferFromId, date")
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
      balance += tx.amount;
    } else if (tx.type === "expense") {
      balance -= tx.amount;
    } else if (tx.type === "transfer") {
      if (tx.transferToId) {
        balance -= tx.amount; // Outgoing
      } else {
        balance += tx.amount; // Incoming
      }
    }
  }

  return balance;
}
