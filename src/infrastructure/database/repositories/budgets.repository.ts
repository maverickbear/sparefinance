/**
 * Budgets Repository
 * Data access layer for budgets - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { logger } from "@/lib/utils/logger";
import { formatTimestamp } from "@/src/infrastructure/utils/timestamp";
import { IBudgetsRepository } from "./interfaces/budgets.repository.interface";

export interface BudgetRow {
  id: string;
  period: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  user_id: string;
  household_id: string | null;
  note: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BudgetSpendingRow {
  categoryId: string | null;
  subcategoryId: string | null;
  actualSpend: number;
  transactionCount: number;
}

export interface AnalyticsBudgetSpendingRow {
  category_id: string | null;
  subcategory_id: string | null;
  actual_spend: number | null;
  transaction_count: number | null;
}

export interface BudgetInsertData {
  id: string;
  period: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  user_id: string;
  household_id: string | null;
  note: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetUpdateData {
  period?: string;
  amount?: number;
  category_id?: string | null;
  subcategory_id?: string | null;
  note?: string | null;
  is_recurring?: boolean;
  updated_at?: string;
}

export class BudgetsRepository implements IBudgetsRepository {
  /**
   * Find all budgets for a period
   */
  async findAllByPeriod(
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Format period as first day of month - use same format as createBudget
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    const periodStr = formatTimestamp(periodStart);

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("period", periodStr)
      .is("deleted_at", null) // Exclude soft-deleted records
      .order("amount", { ascending: false });

    if (error) {
      logger.error("[BudgetsRepository] Error fetching budgets:", error);
      throw new Error(`Failed to fetch budgets: ${error.message}`);
    }

    return (budgets || []) as BudgetRow[];
  }

  /**
   * Get budget spending from materialized view
   * OPTIMIZATION: Uses pre-calculated materialized view instead of scanning transactions
   */
  async getBudgetSpendingByPeriod(
    period: Date,
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Map<string, BudgetSpendingRow>> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Format period as first day of month
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    const periodDateStr = periodStart.toISOString().split('T')[0];

    // Query the materialized view
    const { data: spending, error } = await supabase
      .from("analytics_budget_spending_by_period")
      .select("category_id, subcategory_id, actual_spend, transaction_count")
      .eq("period", periodDateStr)
      .eq("user_id", userId);

    if (error) {
      logger.warn("[BudgetsRepository] Error fetching budget spending from materialized view, falling back to runtime calculation:", error);
      // Return empty map - service will fall back to runtime calculation
      return new Map();
    }

    // Create a map for quick lookups
    // Key format: "category:{id}" | "subcategory:{id}"
    const spendingMap = new Map<string, BudgetSpendingRow>();

    (spending || []).forEach((row: AnalyticsBudgetSpendingRow) => {
      if (row.category_id) {
        spendingMap.set(`category:${row.category_id}`, {
          categoryId: row.category_id,
          subcategoryId: row.subcategory_id,
          actualSpend: row.actual_spend || 0,
          transactionCount: row.transaction_count || 0,
        });
      }
      if (row.subcategory_id) {
        spendingMap.set(`subcategory:${row.subcategory_id}`, {
          categoryId: row.category_id,
          subcategoryId: row.subcategory_id,
          actualSpend: row.actual_spend || 0,
          transactionCount: row.transaction_count || 0,
        });
      }
    });

    return spendingMap;
  }

  /**
   * Find budget by ID
   */
  async findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: budget, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null) // Exclude soft-deleted records
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[BudgetsRepository] Error fetching budget:", error);
      throw new Error(`Failed to fetch budget: ${error.message}`);
    }

    return budget as BudgetRow;
  }

  /**
   * Create a new budget
   */
  async create(data: {
    id: string;
    period: string;
    amount: number;
    categoryId: string | null;
    subcategoryId: string | null;
    userId: string;
    householdId: string | null;
    note: string | null;
    isRecurring: boolean;
    createdAt: string;
    updatedAt: string;
  }): Promise<BudgetRow> {
    const supabase = await createServerClient();

    // Build insert object
    const insertData: BudgetInsertData = {
      id: data.id,
      period: data.period,
      amount: data.amount,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId,
      user_id: data.userId,
      household_id: data.householdId,
      note: data.note,
      is_recurring: data.isRecurring,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error("[BudgetsRepository] Error creating budget:", error);
      const err = new Error(`Failed to create budget: ${error.message}`) as Error & { code?: string };
      err.code = (error as { code?: string }).code;
      throw err;
    }

    return budget as BudgetRow;
  }

  /**
   * Update a budget
   */
  async update(
    id: string,
    data: Partial<{
      period: string;
      amount: number;
      categoryId: string | null;
      subcategoryId: string | null;
      note: string | null;
      isRecurring: boolean;
      updatedAt: string;
    }>
  ): Promise<BudgetRow> {
    const supabase = await createServerClient();

    const updateData: BudgetUpdateData = {};
    if (data.period !== undefined) updateData.period = data.period;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
    if (data.subcategoryId !== undefined) updateData.subcategory_id = data.subcategoryId;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: budget, error } = await supabase
      .from("budgets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[BudgetsRepository] Error updating budget:", error);
      throw new Error(`Failed to update budget: ${error.message}`);
    }

    return budget as BudgetRow;
  }

  /**
   * Soft delete a budget
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("budgets")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null); // Only soft-delete if not already deleted

    if (error) {
      logger.error("[BudgetsRepository] Error soft-deleting budget:", error);
      throw new Error(`Failed to delete budget: ${error.message}`);
    }
  }

  /**
   * Find all recurring budgets for a user
   */
  async findAllRecurring(
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("is_recurring", true)
      .order("period", { ascending: false });

    if (error) {
      logger.error("[BudgetsRepository] Error fetching recurring budgets:", error);
      throw new Error(`Failed to fetch recurring budgets: ${error.message}`);
    }

    return (budgets || []) as BudgetRow[];
  }

  /**
   * Find recurring budgets before a period
   */
  async findRecurringBudgetsBeforePeriod(
    period: Date,
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const periodStr = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .lt("period", periodStr)
      .order("period", { ascending: false });

    if (error) {
      logger.error("[BudgetsRepository] Error fetching recurring budgets:", error);
      return [];
    }

    return (budgets || []) as BudgetRow[];
  }

  /**
   * Check if budget exists for period
   */
  async existsForPeriod(
    period: string,
    categoryId: string | null,
    subcategoryId: string | null,
    userId: string,
    householdId?: string | null
  ): Promise<boolean> {
    const supabase = await createServerClient();

    let query = supabase
      .from("budgets")
      .select("id")
      .eq("period", period)
      .is("deleted_at", null)
      .limit(1);

    // Filter by household if provided, otherwise by user
    if (householdId) {
      query = query.eq("household_id", householdId);
    } else {
      query = query.eq("user_id", userId);
    }

    if (subcategoryId) {
      // Check for subcategory budget
      query = query.eq("subcategory_id", subcategoryId);
    } else if (categoryId) {
      // Check for category budget (must have subcategory_id IS NULL)
      query = query.eq("category_id", categoryId).is("subcategory_id", null);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[BudgetsRepository] Error checking budget existence:", error);
      return false;
    }

    return (data?.length || 0) > 0;
  }
}
