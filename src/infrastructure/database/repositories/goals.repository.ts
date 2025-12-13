/**
 * Goals Repository
 * Data access layer for goals - only handles database operations
 * No business logic here
 */

import { createServerClient } from "../supabase-server";
import { BaseGoal } from "../../../domain/goals/goals.types";
import { logger } from "@/lib/utils/logger";

export interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_balance: number;
  income_percentage: number;
  priority: "High" | "Medium" | "Low";
  is_paused: boolean;
  is_completed: boolean;
  completed_at: string | null;
  description: string | null;
  expected_income: number | null;
  target_months: number | null;
  account_id: string | null;
  holding_id: string | null;
  is_system_goal: boolean;
  user_id: string;
  household_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class GoalsRepository {
  /**
   * Find all goals for a user
   */
  async findAll(
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalRow[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Verify authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logger.warn("[GoalsRepository] User not authenticated, returning empty array");
      return [];
    }

    logger.debug(`[GoalsRepository] Fetching goals for user: ${user.id}`);

    const { data: goals, error } = await supabase
      .from("goals")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      // Handle permission denied errors gracefully (can happen during SSR)
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        logger.warn("[GoalsRepository] Permission denied fetching goals - RLS may be blocking. Returning empty array.", {
          userId: user.id,
          errorCode: error.code,
          errorMessage: error.message,
        });
        return [];
      }
      logger.error("[GoalsRepository] Error fetching goals:", {
        userId: user.id,
        error,
        errorCode: error.code,
        errorMessage: error.message,
      });
      throw new Error(`Failed to fetch goals: ${error.message}`);
    }

    logger.debug(`[GoalsRepository] Found ${goals?.length || 0} goals for user ${user.id}`);
    return (goals || []) as GoalRow[];
  }

  /**
   * Find goal by ID
   */
  async findById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: goal, error } = await supabase
      .from("goals")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null) // Exclude soft-deleted records
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[GoalsRepository] Error fetching goal:", error);
      throw new Error(`Failed to fetch goal: ${error.message}`);
    }

    return goal as GoalRow;
  }

  /**
   * Create a new goal
   */
  async create(data: {
    id: string;
    name: string;
    targetAmount: number;
    currentBalance: number;
    incomePercentage: number;
    priority: "High" | "Medium" | "Low";
    isPaused: boolean;
    isCompleted: boolean;
    completedAt: string | null;
    description: string | null;
    expectedIncome: number | null;
    targetMonths: number | null;
    accountId: string | null;
    holdingId: string | null;
    isSystemGoal: boolean;
    userId: string;
    householdId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<GoalRow> {
    const supabase = await createServerClient();

    const { data: goal, error } = await supabase
      .from("goals")
      .insert({
        id: data.id,
        name: data.name,
        target_amount: data.targetAmount,
        current_balance: data.currentBalance,
        income_percentage: data.incomePercentage,
        priority: data.priority,
        is_paused: data.isPaused,
        is_completed: data.isCompleted,
        completed_at: data.completedAt,
        description: data.description,
        expected_income: data.expectedIncome,
        target_months: data.targetMonths,
        account_id: data.accountId,
        holding_id: data.holdingId,
        is_system_goal: data.isSystemGoal,
        user_id: data.userId,
        household_id: data.householdId,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("[GoalsRepository] Error creating goal:", error);
      throw new Error(`Failed to create goal: ${error.message}`);
    }

    return goal as GoalRow;
  }

  /**
   * Update a goal
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      targetAmount: number;
      currentBalance: number;
      incomePercentage: number;
      priority: "High" | "Medium" | "Low";
      isPaused: boolean;
      isCompleted: boolean;
      completedAt: string | null;
      description: string | null;
      expectedIncome: number | null;
      targetMonths: number | null;
      accountId: string | null;
      holdingId: string | null;
      updatedAt: string;
    }>
  ): Promise<GoalRow> {
    const supabase = await createServerClient();

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.targetAmount !== undefined) updateData.target_amount = data.targetAmount;
    if (data.currentBalance !== undefined) updateData.current_balance = data.currentBalance;
    if (data.incomePercentage !== undefined) updateData.income_percentage = data.incomePercentage;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isPaused !== undefined) updateData.is_paused = data.isPaused;
    if (data.isCompleted !== undefined) updateData.is_completed = data.isCompleted;
    if (data.completedAt !== undefined) updateData.completed_at = data.completedAt;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.expectedIncome !== undefined) updateData.expected_income = data.expectedIncome;
    if (data.targetMonths !== undefined) updateData.target_months = data.targetMonths;
    if (data.accountId !== undefined) updateData.account_id = data.accountId;
    if (data.holdingId !== undefined) updateData.holding_id = data.holdingId;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { data: goal, error } = await supabase
      .from("goals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[GoalsRepository] Error updating goal:", error);
      throw new Error(`Failed to update goal: ${error.message}`);
    }

    return goal as GoalRow;
  }

  /**
   * Soft delete a goal
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("goals")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null); // Only soft-delete if not already deleted

    if (error) {
      logger.error("[GoalsRepository] Error soft-deleting goal:", error);
      throw new Error(`Failed to delete goal: ${error.message}`);
    }
  }

  /**
   * Find system goal by type
   */
  async findSystemGoal(
    userId: string,
    isSystemGoal: boolean = true
  ): Promise<GoalRow | null> {
    const supabase = await createServerClient();

    const { data: goal, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_system_goal", isSystemGoal)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[GoalsRepository] Error fetching system goal:", error);
      return null;
    }

    return goal as GoalRow;
  }

  /**
   * Find emergency fund goal by household ID
   */
  async findEmergencyFundGoal(
    householdId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalRow | null> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: goal, error } = await supabase
      .from("goals")
      .select("*")
      .eq("household_id", householdId)
      .eq("name", "Emergency Funds")
      .eq("is_system_goal", true)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[GoalsRepository] Error fetching emergency fund goal:", error);
      return null;
    }

    return goal as GoalRow | null;
  }
}

