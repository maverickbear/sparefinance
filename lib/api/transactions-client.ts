"use client";

import { supabase } from "@/lib/supabase";
import { formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { TransactionFormData } from "@/lib/validations/transaction";
import { formatTimestamp } from "@/lib/utils/timestamp";

import type { PlaidTransactionMetadata } from '@/lib/api/plaid/types';

export interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  accountId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  recurring?: boolean;
  expenseType?: "fixed" | "variable" | null; // Only for expense transactions
  suggestedCategoryId?: string | null;
  suggestedSubcategoryId?: string | null;
  plaidMetadata?: PlaidTransactionMetadata | null;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  suggestedCategory?: { id: string; name: string } | null;
  suggestedSubcategory?: { id: string; name: string } | null;
}

/**
 * Get transactions with filters
 */
export async function getTransactionsClient(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  type?: string;
  search?: string;
  recurring?: boolean;
}): Promise<Transaction[]> {
  // Use explicit foreign key names to avoid ambiguity
  // Since we now have two relationships to Category (categoryId and suggestedCategoryId),
  // we need to specify which one to use
  let query = supabase
    .from("Transaction")
    .select(`
      *,
      account:Account(*),
      category:Category!Transaction_categoryId_fkey(*),
      subcategory:Subcategory!Transaction_subcategoryId_fkey(*)
    `)
    .order("date", { ascending: false });

  if (filters?.startDate) {
    // Use formatDateStart to ensure proper PostgreSQL timestamp format
    const startDateStr = formatDateStart(filters.startDate);
    query = query.gte("date", startDateStr);
  }

  if (filters?.endDate) {
    // Use formatDateEnd to ensure proper PostgreSQL timestamp format
    const endDateStr = formatDateEnd(filters.endDate);
    query = query.lte("date", endDateStr);
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
    console.error("Supabase error fetching transactions:", error);
    throw new Error(`Failed to fetch transactions: ${error.message || JSON.stringify(error)}`);
  }

  if (!data || data.length === 0) {
    console.log("[getTransactionsClient] No transactions found with filters:", {
      startDate: filters?.startDate ? formatDateStart(filters.startDate) : undefined,
      endDate: filters?.endDate ? formatDateEnd(filters.endDate) : undefined,
      accountId: filters?.accountId,
      type: filters?.type,
    });
    
    // Try to fetch all transactions without filters to debug
    const { data: allData, error: allError } = await supabase
      .from("Transaction")
      .select("id, date, type, amount, accountId, userId")
      .order("date", { ascending: false })
      .limit(10);
    
    if (!allError && allData) {
      console.log(`[getTransactionsClient] Found ${allData.length} total transactions in database (sample):`, allData);
    }
    
    return [];
  }

  console.log(`[getTransactionsClient] Found ${data.length} transactions with filters`);

  // Get unique suggested category IDs
  const suggestedCategoryIds = [...new Set(data.map((tx: any) => tx.suggestedCategoryId).filter(Boolean))];
  const suggestedSubcategoryIds = [...new Set(data.map((tx: any) => tx.suggestedSubcategoryId).filter(Boolean))];

  console.log('[getTransactionsClient] Suggested category IDs:', suggestedCategoryIds);
  console.log('[getTransactionsClient] Transactions with suggestions:', data.filter((tx: any) => tx.suggestedCategoryId).length);

  // Fetch suggested categories separately
  const suggestedCategoriesMap = new Map<string, { id: string; name: string }>();
  const suggestedSubcategoriesMap = new Map<string, { id: string; name: string }>();

  if (suggestedCategoryIds.length > 0) {
    const { data: suggestedCategories, error: suggestedCategoriesError } = await supabase
      .from("Category")
      .select("id, name")
      .in("id", suggestedCategoryIds);

    if (suggestedCategoriesError) {
      console.error('[getTransactionsClient] Error fetching suggested categories:', suggestedCategoriesError);
    } else if (suggestedCategories) {
      console.log('[getTransactionsClient] Fetched suggested categories:', suggestedCategories.length);
      suggestedCategories.forEach((cat) => {
        suggestedCategoriesMap.set(cat.id, cat);
      });
    }
  }

  if (suggestedSubcategoryIds.length > 0) {
    const { data: suggestedSubcategories, error: suggestedSubcategoriesError } = await supabase
      .from("Subcategory")
      .select("id, name")
      .in("id", suggestedSubcategoryIds);

    if (suggestedSubcategoriesError) {
      console.error('[getTransactionsClient] Error fetching suggested subcategories:', suggestedSubcategoriesError);
    } else if (suggestedSubcategories) {
      suggestedSubcategories.forEach((subcat) => {
        suggestedSubcategoriesMap.set(subcat.id, subcat);
      });
    }
  }

  // Handle relations
  const transactions = (data || []).map((tx: any) => {
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

    const suggestedCategory = tx.suggestedCategoryId ? suggestedCategoriesMap.get(tx.suggestedCategoryId) || null : null;
    const suggestedSubcategory = tx.suggestedSubcategoryId ? suggestedSubcategoriesMap.get(tx.suggestedSubcategoryId) || null : null;
    
    // Debug log for transactions with suggestions
    if (tx.suggestedCategoryId) {
      console.log('[getTransactionsClient] Transaction with suggestion:', {
        id: tx.id,
        description: tx.description,
        suggestedCategoryId: tx.suggestedCategoryId,
        suggestedSubcategoryId: tx.suggestedSubcategoryId,
        suggestedCategory: suggestedCategory,
        suggestedSubcategory: suggestedSubcategory,
        hasCategory: !!tx.categoryId,
        categoryId: tx.categoryId,
      });
    }
    
    // Ensure all fields are preserved, especially suggestedCategoryId and suggestedSubcategoryId
    return {
      ...tx,
      account: account || null,
      category: category || null,
      subcategory: subcategory || null,
      // Explicitly preserve suggestedCategoryId and suggestedSubcategoryId
      suggestedCategoryId: tx.suggestedCategoryId || null,
      suggestedSubcategoryId: tx.suggestedSubcategoryId || null,
      suggestedCategory: suggestedCategory || null,
      suggestedSubcategory: suggestedSubcategory || null,
    };
  });

  return transactions;
}

/**
 * Create a transaction
 */
export async function createTransactionClient(data: TransactionFormData): Promise<Transaction> {
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }
  const userId = user.id;

  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  const formatDate = formatTimestamp;

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
      userId: userId, // Add userId directly to transaction
      categoryId: data.categoryId || null,
      subcategoryId: data.subcategoryId || null,
      description: data.description || null,
      recurring: data.recurring ?? false,
      expenseType: data.type === "expense" ? (data.expenseType || null) : null,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating transaction:", error);
    throw new Error(`Failed to create transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

/**
 * Update a transaction
 */
export async function updateTransactionClient(id: string, data: Partial<TransactionFormData>): Promise<Transaction> {
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
    updateData.date = formatTimestamp(date);
  }
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId || null;
  if (data.description !== undefined) updateData.description = data.description || null;
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
    console.error("Supabase error updating transaction:", error);
    throw new Error(`Failed to update transaction: ${error.message || JSON.stringify(error)}`);
  }

  return transaction;
}

/**
 * Delete a transaction
 * Uses API route to ensure cache invalidation
 */
export async function deleteTransactionClient(id: string): Promise<void> {
  const response = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete transaction' }));
    throw new Error(error.error || 'Failed to delete transaction');
  }
}

/**
 * Delete multiple transactions
 * Uses API route to ensure cache invalidation
 */
export async function deleteMultipleTransactionsClient(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  // Delete transactions one by one via API route to ensure proper cache invalidation
  // This is more reliable than batch deletion for cache management
  const results = await Promise.allSettled(
    ids.map(id => 
      fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      })
    )
  );

  // Check if any deletions failed
  const failures = results.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok));
  
  if (failures.length > 0) {
    // Try to get error messages from failed requests
    const errorMessages = await Promise.all(
      failures.map(async (failure) => {
        if (failure.status === 'fulfilled') {
          const error = await failure.value.json().catch(() => ({ error: 'Failed to delete transaction' }));
          return error.error || 'Failed to delete transaction';
        }
        return failure.reason?.message || 'Failed to delete transaction';
      })
    );
    
    throw new Error(`Failed to delete ${failures.length} transaction(s): ${errorMessages.join(', ')}`);
  }
}

