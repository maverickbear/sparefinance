import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/lib/utils/timestamp";
import { logger } from "@/lib/utils/logger";
import { encryptDescription, decryptDescription, decryptAmount } from "@/lib/utils/transaction-encryption";
import { createTransaction } from "./transactions";
import type { TransactionFormData } from "@/lib/validations/transaction";

// Constant for planned payment horizon (90 days)
export const PLANNED_HORIZON_DAYS = 90;

export interface PlannedPayment {
  id: string;
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  source: "recurring" | "debt" | "manual" | "subscription";
  status: "scheduled" | "paid" | "skipped" | "cancelled";
  linkedTransactionId?: string | null;
  debtId?: string | null;
  subscriptionId?: string | null;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  account?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
}

export interface PlannedPaymentFormData {
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  source?: "recurring" | "debt" | "manual" | "subscription";
  debtId?: string | null;
  subscriptionId?: string | null;
}

/**
 * Create a new planned payment
 */
export async function createPlannedPayment(
  data: PlannedPaymentFormData,
  accessToken?: string,
  refreshToken?: string
): Promise<PlannedPayment> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Get active household ID
  const { getActiveHouseholdId } = await import("@/lib/utils/household");
  const householdId = await getActiveHouseholdId(user.id);
  if (!householdId) {
    throw new Error("No active household found. Please contact support.");
  }

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());
  const date = data.date instanceof Date ? data.date : new Date(data.date);
  const transactionDate = formatDateOnly(date);

  // Encrypt description
  const encryptedDescription = encryptDescription(data.description || null);

  const plannedPaymentData = {
    id,
    date: transactionDate,
    type: data.type,
    amount: data.amount,
    accountId: data.accountId,
    toAccountId: data.type === "transfer" ? (data.toAccountId || null) : null,
    categoryId: data.type === "transfer" ? null : (data.categoryId || null),
    subcategoryId: data.type === "transfer" ? null : (data.subcategoryId || null),
    description: encryptedDescription,
    source: data.source || "manual",
    status: "scheduled" as const,
    debtId: data.debtId || null,
    subscriptionId: data.subscriptionId || null,
    userId: user.id,
    householdId: householdId, // Add householdId for household-based architecture
    createdAt: now,
    updatedAt: now,
  };

  const { data: plannedPayment, error } = await supabase
    .from("PlannedPayment")
    .insert(plannedPaymentData)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error creating planned payment:", error);
    throw new Error(`Failed to create planned payment: ${error.message || JSON.stringify(error)}`);
  }

  // Fetch related data
  const plannedPaymentWithRelations = await enrichPlannedPayment(plannedPayment, supabase);

  return plannedPaymentWithRelations;
}

/**
 * Get planned payments with optional filters
 */
export async function getPlannedPayments(filters?: {
  startDate?: Date;
  endDate?: Date;
  status?: "scheduled" | "paid" | "skipped" | "cancelled";
  source?: "recurring" | "debt" | "manual" | "subscription";
  debtId?: string;
  subscriptionId?: string;
  accountId?: string;
  type?: "expense" | "income" | "transfer";
  limit?: number;
}, accessToken?: string, refreshToken?: string): Promise<PlannedPayment[]> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return [];
  }

  let query = supabase
    .from("PlannedPayment")
    .select("*")
    .eq("userId", user.id)
    .order("date", { ascending: true });

  if (filters?.startDate) {
    query = query.gte("date", formatDateOnly(filters.startDate));
  }

  if (filters?.endDate) {
    query = query.lte("date", formatDateOnly(filters.endDate));
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  if (filters?.debtId) {
    query = query.eq("debtId", filters.debtId);
  }

  if (filters?.subscriptionId) {
    query = query.eq("subscriptionId", filters.subscriptionId);
  }

  if (filters?.accountId) {
    query = query.eq("accountId", filters.accountId);
  }

  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Supabase error fetching planned payments:", error);
    throw new Error(`Failed to fetch planned payments: ${error.message || JSON.stringify(error)}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Enrich with related data
  const enrichedPayments = await Promise.all(
    data.map((pp) => enrichPlannedPayment(pp, supabase))
  );

  return enrichedPayments;
}

/**
 * Mark a planned payment as paid and convert it to a transaction
 */
export async function markPlannedPaymentAsPaid(
  plannedPaymentId: string,
  accessToken?: string,
  refreshToken?: string
): Promise<{ plannedPayment: PlannedPayment; transaction: any }> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Get the planned payment
  const { data: plannedPayment, error: fetchError } = await supabase
    .from("PlannedPayment")
    .select("*")
    .eq("id", plannedPaymentId)
    .eq("userId", user.id)
    .eq("status", "scheduled")
    .single();

  if (fetchError || !plannedPayment) {
    throw new Error("Planned payment not found or already processed");
  }

  // Check if already has a linked transaction (idempotency)
  if (plannedPayment.linkedTransactionId) {
    // Fetch the existing transaction
    const { data: existingTransaction } = await supabase
      .from("Transaction")
      .select("*")
      .eq("id", plannedPayment.linkedTransactionId)
      .single();

    if (existingTransaction) {
      const enrichedPlannedPayment = await enrichPlannedPayment(plannedPayment, supabase);
      return {
        plannedPayment: enrichedPlannedPayment,
        transaction: existingTransaction,
      };
    }
  }

  // Decrypt description
  const description = decryptDescription(plannedPayment.description);

  // Create transaction from planned payment
  const transactionData: TransactionFormData = {
    date: new Date(plannedPayment.date),
    type: plannedPayment.type,
    amount: plannedPayment.amount,
    accountId: plannedPayment.accountId,
    toAccountId: plannedPayment.type === "transfer" ? (plannedPayment.toAccountId || undefined) : undefined,
    categoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.categoryId || undefined),
    subcategoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.subcategoryId || undefined),
    description: description || undefined,
    recurring: false, // Planned payments are not recurring
  };

  const transaction = await createTransaction(transactionData);

  // Update planned payment status and link transaction
  const now = formatTimestamp(new Date());
  const { data: updatedPlannedPayment, error: updateError } = await supabase
    .from("PlannedPayment")
    .update({
      status: "paid",
      linkedTransactionId: transaction.id,
      updatedAt: now,
    })
    .eq("id", plannedPaymentId)
    .select()
    .single();

  if (updateError) {
    logger.error("Error updating planned payment:", updateError);
    // Transaction was created, but we couldn't update the planned payment
    // This is not ideal, but the transaction exists
    throw new Error("Transaction created but failed to update planned payment status");
  }

  const enrichedPlannedPayment = await enrichPlannedPayment(updatedPlannedPayment, supabase);

  return {
    plannedPayment: enrichedPlannedPayment,
    transaction,
  };
}

/**
 * Update a planned payment
 */
export async function updatePlannedPayment(
  id: string,
  data: Partial<PlannedPaymentFormData>,
  accessToken?: string,
  refreshToken?: string
): Promise<PlannedPayment> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Check ownership
  const { data: existing, error: checkError } = await supabase
    .from("PlannedPayment")
    .select("id, status, type")
    .eq("id", id)
    .eq("userId", user.id)
    .single();

  if (checkError || !existing) {
    throw new Error("Planned payment not found");
  }

  if (existing.status !== "scheduled") {
    throw new Error("Can only update scheduled planned payments");
  }

  const updateData: any = {
    updatedAt: formatTimestamp(new Date()),
  };

  if (data.date !== undefined) {
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    updateData.date = formatDateOnly(date);
  }

  if (data.type !== undefined) {
    updateData.type = data.type;
    // When type changes, update related fields accordingly
    if (data.type === "transfer") {
      updateData.categoryId = null;
      updateData.subcategoryId = null;
    } else {
      updateData.toAccountId = null;
    }
  }

  if (data.amount !== undefined) {
    updateData.amount = data.amount;
  }

  if (data.accountId !== undefined) {
    updateData.accountId = data.accountId;
  }

  if (data.toAccountId !== undefined) {
    const finalType = data.type !== undefined ? data.type : existing.type;
    updateData.toAccountId = finalType === "transfer" ? (data.toAccountId || null) : null;
  }

  if (data.categoryId !== undefined) {
    const finalType = data.type !== undefined ? data.type : existing.type;
    updateData.categoryId = finalType === "transfer" ? null : (data.categoryId || null);
  }

  if (data.subcategoryId !== undefined) {
    const finalType = data.type !== undefined ? data.type : existing.type;
    updateData.subcategoryId = finalType === "transfer" ? null : (data.subcategoryId || null);
  }

  if (data.description !== undefined) {
    updateData.description = encryptDescription(data.description || null);
  }

  const { data: updated, error } = await supabase
    .from("PlannedPayment")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Supabase error updating planned payment:", error);
    throw new Error(`Failed to update planned payment: ${error.message || JSON.stringify(error)}`);
  }

  const enrichedPlannedPayment = await enrichPlannedPayment(updated, supabase);

  return enrichedPlannedPayment;
}

/**
 * Delete a planned payment
 */
export async function deletePlannedPayment(
  id: string,
  accessToken?: string,
  refreshToken?: string
): Promise<void> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("PlannedPayment")
    .delete()
    .eq("id", id)
    .eq("userId", user.id);

  if (error) {
    logger.error("Supabase error deleting planned payment:", error);
    throw new Error(`Failed to delete planned payment: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Skip a planned payment (mark as skipped without creating transaction)
 */
export async function skipPlannedPayment(
  id: string,
  accessToken?: string,
  refreshToken?: string
): Promise<PlannedPayment> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: updated, error } = await supabase
    .from("PlannedPayment")
    .update({
      status: "skipped",
      updatedAt: formatTimestamp(new Date()),
    })
    .eq("id", id)
    .eq("userId", user.id)
    .eq("status", "scheduled") // Only allow skipping scheduled payments
    .select()
    .single();

  if (error) {
    logger.error("Supabase error skipping planned payment:", error);
    throw new Error(`Failed to skip planned payment: ${error.message || JSON.stringify(error)}`);
  }

  const enrichedPlannedPayment = await enrichPlannedPayment(updated, supabase);

  return enrichedPlannedPayment;
}

/**
 * Cancel a planned payment (mark as cancelled without creating transaction)
 */
export async function cancelPlannedPayment(
  id: string,
  accessToken?: string,
  refreshToken?: string
): Promise<PlannedPayment> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: updated, error } = await supabase
    .from("PlannedPayment")
    .update({
      status: "cancelled",
      updatedAt: formatTimestamp(new Date()),
    })
    .eq("id", id)
    .eq("userId", user.id)
    .eq("status", "scheduled") // Only allow cancelling scheduled payments
    .select()
    .single();

  if (error) {
    logger.error("Supabase error cancelling planned payment:", error);
    throw new Error(`Failed to cancel planned payment: ${error.message || JSON.stringify(error)}`);
  }

  const enrichedPlannedPayment = await enrichPlannedPayment(updated, supabase);

  return enrichedPlannedPayment;
}

/**
 * Generate PlannedPayments from a recurring transaction
 * Creates PlannedPayments for the next occurrences within the horizon (90 days)
 */
export async function generatePlannedPaymentsFromRecurringTransaction(
  transactionId: string,
  accessToken?: string,
  refreshToken?: string
): Promise<number> {
  const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Get the transaction
  const { data: transaction, error: txError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", transactionId)
    .eq("userId", user.id)
    .eq("recurring", true)
    .single();

  if (txError || !transaction) {
    logger.error("Error fetching recurring transaction:", txError);
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
  horizonDate.setHours(23, 59, 59, 999);

  const originalDate = new Date(transaction.date);
  const originalDay = originalDate.getDate();
  const originalMonth = originalDate.getMonth();
  const originalYear = originalDate.getFullYear();

  // Decrypt amount and description
  const amount = decryptAmount(transaction.amount) ?? 0;
  const description = decryptDescription(transaction.description);

  let createdCount = 0;

  // Generate planned payments for next 12 months (or until horizon)
  for (let monthsAhead = 1; monthsAhead <= 12; monthsAhead++) {
    // Calculate next occurrence date
    let nextDate = new Date(originalYear, originalMonth + monthsAhead, originalDay);
    nextDate.setHours(0, 0, 0, 0);

    // Handle edge case: if day doesn't exist in month (e.g., Jan 31 -> Feb)
    if (nextDate.getDate() !== originalDay) {
      nextDate = new Date(originalYear, originalMonth + monthsAhead + 1, 0);
      nextDate.setHours(0, 0, 0, 0);
    }

    // Only create if date is in the future and within horizon
    if (nextDate >= today && nextDate <= horizonDate) {
      // Check if PlannedPayment already exists for this transaction and date
      const { data: existing } = await supabase
        .from("PlannedPayment")
        .select("id")
        .eq("userId", user.id)
        .eq("accountId", transaction.accountId)
        .eq("date", formatDateOnly(nextDate))
        .eq("type", transaction.type)
        .eq("source", "recurring")
        .eq("status", "scheduled")
        .maybeSingle();

      if (!existing) {
        try {
          await createPlannedPayment(
            {
              date: nextDate,
              type: transaction.type as "expense" | "income" | "transfer",
              amount: amount,
              accountId: transaction.accountId,
              toAccountId: transaction.type === "transfer" ? (transaction.toAccountId || null) : null,
              categoryId: transaction.type === "transfer" ? null : (transaction.categoryId || null),
              subcategoryId: transaction.type === "transfer" ? null : (transaction.subcategoryId || null),
              description: description || null,
              source: "recurring",
            },
            accessToken,
            refreshToken
          );
          createdCount++;
        } catch (error) {
          logger.error(`Error creating planned payment for recurring transaction ${transactionId}:`, error);
          // Continue with next occurrence even if one fails
        }
      }
    }

    // Stop if we've exceeded horizon
    if (nextDate > horizonDate) {
      break;
    }
  }

  logger.info(`Generated ${createdCount} planned payments from recurring transaction ${transactionId}`);
  return createdCount;
}

/**
 * Helper function to enrich planned payment with related data
 */
async function enrichPlannedPayment(
  plannedPayment: any,
  supabase: any
): Promise<PlannedPayment> {
  // Fetch related data
  const [accountResult, toAccountResult, categoryResult, subcategoryResult] = await Promise.all([
    plannedPayment.accountId
      ? supabase.from("Account").select("id, name").eq("id", plannedPayment.accountId).single()
      : Promise.resolve({ data: null, error: null }),
    plannedPayment.toAccountId
      ? supabase.from("Account").select("id, name").eq("id", plannedPayment.toAccountId).single()
      : Promise.resolve({ data: null, error: null }),
    plannedPayment.categoryId
      ? supabase.from("Category").select("id, name").eq("id", plannedPayment.categoryId).single()
      : Promise.resolve({ data: null, error: null }),
    plannedPayment.subcategoryId
      ? supabase.from("Subcategory").select("id, name, logo").eq("id", plannedPayment.subcategoryId).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const account = accountResult.data || null;
  const toAccount = toAccountResult.data || null;
  const category = categoryResult.data || null;
  const subcategory = subcategoryResult.data || null;

  // Decrypt description
  const description = decryptDescription(plannedPayment.description);

  return {
    ...plannedPayment,
    date: new Date(plannedPayment.date),
    amount: Number(plannedPayment.amount),
    description,
    account,
    toAccount,
    category,
    subcategory,
    createdAt: new Date(plannedPayment.createdAt),
    updatedAt: new Date(plannedPayment.updatedAt),
  };
}

