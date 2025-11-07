"use client";

import { supabase } from "@/lib/supabase";
import { TransactionFormData } from "@/lib/validations/transaction";
import { formatTimestamp } from "@/lib/utils/timestamp";

export interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  accountId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  tags?: string[];
  recurring?: boolean;
  transferToId?: string | null;
  transferFromId?: string | null;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
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
    const startDate = new Date(filters.startDate);
    startDate.setHours(0, 0, 0, 0);
    query = query.gte("date", startDate.toISOString());
  }

  if (filters?.endDate) {
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte("date", endDate.toISOString());
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
    return [];
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
    
    return {
      ...tx,
      account: account || null,
      category: category || null,
      subcategory: subcategory || null,
      tags: tx.tags ? (typeof tx.tags === 'string' ? JSON.parse(tx.tags) : tx.tags) : [],
    };
  });

  return transactions;
}

/**
 * Create a transaction
 */
export async function createTransactionClient(data: TransactionFormData): Promise<Transaction> {
  if (data.type === "transfer" && !data.transferToId) {
    throw new Error("Transfer destination is required");
  }

  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const now = formatTimestamp(new Date());
  const formatDate = formatTimestamp;

  if (data.type === "transfer") {
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

    return { ...outgoing, tags: [] };
  }

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
    console.error("Supabase error creating transaction:", error);
    throw new Error(`Failed to create transaction: ${error.message || JSON.stringify(error)}`);
  }

  return { ...transaction, tags: data.tags || [] };
}

/**
 * Update a transaction
 */
export async function updateTransactionClient(id: string, data: Partial<TransactionFormData>): Promise<Transaction> {
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

  return { ...transaction, tags: transaction.tags ? (typeof transaction.tags === 'string' ? JSON.parse(transaction.tags) : transaction.tags) : [] };
}

/**
 * Delete a transaction
 */
export async function deleteTransactionClient(id: string): Promise<void> {
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

