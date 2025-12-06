/**
 * Planned Payments Repository
 * Data access layer for planned payments - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";
import { formatDateOnly } from "@/src/infrastructure/utils/timestamp";

export interface PlannedPaymentRow {
  id: string;
  date: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  description: string | null; // Encrypted
  source: "recurring" | "debt" | "manual" | "subscription" | "goal";
  status: "scheduled" | "paid" | "skipped" | "cancelled";
  linkedTransactionId: string | null;
  debtId: string | null;
  subscriptionId: string | null;
  goalId: string | null;
  userId: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export class PlannedPaymentsRepository {
  /**
   * Find all planned payments for a user with optional filters
   */
  async findAll(
    userId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
      source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
      debtId?: string;
      subscriptionId?: string;
      goalId?: string;
      accountId?: string;
      type?: "expense" | "income" | "transfer";
      limit?: number;
      page?: number;
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ data: PlannedPaymentRow[]; count: number | null }> {
    const supabase = await createServerClient(accessToken, refreshToken);

    let query = supabase
      .from("PlannedPayment")
      .select("id, date, type, amount, accountId, toAccountId, categoryId, subcategoryId, description, source, status, linkedTransactionId, debtId, subscriptionId, userId, createdAt, updatedAt, householdId", { count: "exact" })
      .eq("userId", userId)
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

    // Note: goalId column does not exist in PlannedPayment table
    // If goalId filter is provided, it will be ignored

    if (filters?.accountId) {
      query = query.eq("accountId", filters.accountId);
    }

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }

    // Apply pagination
    if (filters?.page !== undefined && filters?.limit !== undefined) {
      const page = Math.max(1, filters.page);
      const limit = Math.max(1, Math.min(100, filters.limit));
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    } else if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("[PlannedPaymentsRepository] Error fetching planned payments:", error);
      throw new Error(`Failed to fetch planned payments: ${error.message}`);
    }

    logger.info("[PlannedPaymentsRepository] Query result:", {
      userId,
      filters: {
        startDate: filters?.startDate?.toISOString(),
        endDate: filters?.endDate?.toISOString(),
        status: filters?.status,
        type: filters?.type,
        source: filters?.source,
        page: filters?.page,
        limit: filters?.limit,
      },
      dataCount: data?.length || 0,
      totalCount: count,
      firstItem: data?.[0] ? {
        id: data[0].id,
        date: data[0].date,
        type: data[0].type,
        status: data[0].status,
        source: data[0].source,
      } : null,
    });

    return {
      data: (data || []) as PlannedPaymentRow[],
      count: count || null,
    };
  }

  /**
   * Find planned payment by ID
   */
  async findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<PlannedPaymentRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: plannedPayment, error } = await supabase
      .from("PlannedPayment")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[PlannedPaymentsRepository] Error fetching planned payment:", error);
      throw new Error(`Failed to fetch planned payment: ${error.message}`);
    }

    return plannedPayment as PlannedPaymentRow;
  }

  /**
   * Create a new planned payment
   */
  async create(data: Omit<PlannedPaymentRow, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<PlannedPaymentRow> {
    const supabase = await createServerClient();

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: plannedPayment, error } = await supabase
      .from("PlannedPayment")
      .insert({
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("[PlannedPaymentsRepository] Error creating planned payment:", error);
      throw new Error(`Failed to create planned payment: ${error.message}`);
    }

    return plannedPayment as PlannedPaymentRow;
  }

  /**
   * Update a planned payment
   */
  async update(
    id: string,
    data: Partial<Omit<PlannedPaymentRow, "id" | "userId" | "householdId" | "createdAt">>
  ): Promise<PlannedPaymentRow> {
    const supabase = await createServerClient();

    const { data: plannedPayment, error } = await supabase
      .from("PlannedPayment")
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[PlannedPaymentsRepository] Error updating planned payment:", error);
      throw new Error(`Failed to update planned payment: ${error.message}`);
    }

    return plannedPayment as PlannedPaymentRow;
  }

  /**
   * Delete a planned payment
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("PlannedPayment")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[PlannedPaymentsRepository] Error deleting planned payment:", error);
      throw new Error(`Failed to delete planned payment: ${error.message}`);
    }
  }

  /**
   * Count planned payments by type (expense, income, transfer) in a single query
   * This is more efficient than making 3 separate queries
   */
  async countByType(
    userId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ expense: number; income: number; transfer: number }> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Build base query with filters (excluding type filter)
    let query = supabase
      .from("PlannedPayment")
      .select("type", { count: "exact" })
      .eq("userId", userId);

    if (filters?.startDate) {
      query = query.gte("date", formatDateOnly(filters.startDate));
    }

    if (filters?.endDate) {
      query = query.lte("date", formatDateOnly(filters.endDate));
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    // Fetch all matching rows (only type field, no pagination)
    // We'll group by type in code since Supabase doesn't support GROUP BY in count queries
    const { data, error } = await query;

    if (error) {
      logger.error("[PlannedPaymentsRepository] Error counting planned payments by type:", error);
      throw new Error(`Failed to count planned payments: ${error.message}`);
    }

    // Initialize counts
    const counts = {
      expense: 0,
      income: 0,
      transfer: 0,
    };

    // Count by type
    if (data) {
      data.forEach((row) => {
        if (row.type === "expense") {
          counts.expense++;
        } else if (row.type === "income") {
          counts.income++;
        } else if (row.type === "transfer") {
          counts.transfer++;
        }
      });
    }

    logger.info("[PlannedPaymentsRepository] Count by type result:", {
      userId,
      filters: {
        startDate: filters?.startDate?.toISOString(),
        endDate: filters?.endDate?.toISOString(),
        status: filters?.status,
      },
      counts,
    });

    return counts;
  }
}

