/**
 * Budgets Repository
 * Data access layer for budgets - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseBudget } from "../../../domain/budgets/budgets.types";
import { logger } from "@/lib/utils/logger";

export interface BudgetRow {
  id: string;
  period: string;
  amount: number;
  categoryId: string | null;
  subcategoryId: string | null;
  groupId: string | null;
  userId: string;
  note: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export class BudgetsRepository {
  /**
   * Find all budgets for a period
   */
  async findAllByPeriod(
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Format period as first day of month
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    const periodStr = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(periodStart.getDate()).padStart(2, '0')} 00:00:00`;

    const { data: budgets, error } = await supabase
      .from("Budget")
      .select("*")
      .eq("period", periodStr)
      .order("amount", { ascending: false });

    if (error) {
      logger.error("[BudgetsRepository] Error fetching budgets:", error);
      throw new Error(`Failed to fetch budgets: ${error.message}`);
    }

    return (budgets || []) as BudgetRow[];
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
      .from("Budget")
      .select("*")
      .eq("id", id)
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
    groupId: string | null;
    userId: string;
    note: string | null;
    isRecurring: boolean;
    createdAt: string;
    updatedAt: string;
  }): Promise<BudgetRow> {
    const supabase = await createServerClient();

    const { data: budget, error } = await supabase
      .from("Budget")
      .insert({
        id: data.id,
        period: data.period,
        amount: data.amount,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        groupId: data.groupId,
        userId: data.userId,
        note: data.note,
        isRecurring: data.isRecurring,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[BudgetsRepository] Error creating budget:", error);
      throw new Error(`Failed to create budget: ${error.message}`);
    }

    return budget as BudgetRow;
  }

  /**
   * Update a budget
   */
  async update(
    id: string,
    data: Partial<{
      amount: number;
      note: string | null;
      isRecurring: boolean;
      updatedAt: string;
    }>
  ): Promise<BudgetRow> {
    const supabase = await createServerClient();

    const { data: budget, error } = await supabase
      .from("Budget")
      .update(data)
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
   * Delete a budget
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Budget")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[BudgetsRepository] Error deleting budget:", error);
      throw new Error(`Failed to delete budget: ${error.message}`);
    }
  }

  /**
   * Find recurring budgets before a period
   */
  async findRecurringBudgetsBeforePeriod(
    period: Date,
    userId: string
  ): Promise<BudgetRow[]> {
    const supabase = await createServerClient();

    const periodStr = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

    const { data: budgets, error } = await supabase
      .from("Budget")
      .select("*")
      .eq("userId", userId)
      .eq("isRecurring", true)
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
    groupId: string | null,
    userId: string
  ): Promise<boolean> {
    const supabase = await createServerClient();

    let query = supabase
      .from("Budget")
      .select("id")
      .eq("period", period)
      .eq("userId", userId)
      .limit(1);

    if (groupId) {
      query = query.eq("groupId", groupId);
    } else if (subcategoryId) {
      query = query.eq("subcategoryId", subcategoryId);
    } else if (categoryId) {
      query = query.eq("categoryId", categoryId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[BudgetsRepository] Error checking budget existence:", error);
      return false;
    }

    return (data?.length || 0) > 0;
  }
}

