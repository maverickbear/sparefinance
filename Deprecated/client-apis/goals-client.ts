"use client";

import { supabase } from "@/lib/supabase";

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  isPaused: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
  description?: string | null;
  expectedIncome?: number | null;
  targetMonths?: number | null;
  accountId?: string | null;
  holdingId?: string | null;
  isSystemGoal?: boolean;
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  monthlyContribution?: number;
  monthsToGoal?: number | null;
  progressPct?: number;
  incomeBasis?: number;
}

/**
 * Get all goals
 */
export async function getGoalsClient(): Promise<Goal[]> {
  const { data: goals, error } = await supabase
    .from("Goal")
    .select("*")
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Supabase error fetching goals:", error);
    return [];
  }

  return goals || [];
}

/**
 * Update a goal
 */
export async function updateGoalClient(id: string, data: Partial<Goal>): Promise<Goal> {
  const updateData: Record<string, unknown> = { ...data };
  updateData.updatedAt = new Date().toISOString();

  const { data: goal, error } = await supabase
    .from("Goal")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating goal:", error);
    throw new Error(`Failed to update goal: ${error.message || JSON.stringify(error)}`);
  }

  return goal;
}

/**
 * Delete a goal
 */
export async function deleteGoalClient(id: string): Promise<void> {
  // Check if this is a system goal (cannot be deleted)
  const { data: goal, error: fetchError } = await supabase
    .from("Goal")
    .select("isSystemGoal")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw new Error("Goal not found");
  }

  if (goal?.isSystemGoal === true) {
    throw new Error("System goals cannot be deleted. You can edit them instead.");
  }

  const { error } = await supabase.from("Goal").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting goal:", error);
    throw new Error(`Failed to delete goal: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Top up a goal (add money)
 */
export async function topUpGoalClient(goalId: string, amount: number): Promise<Goal> {
  const { data: goal, error: fetchError } = await supabase
    .from("Goal")
    .select("currentBalance")
    .eq("id", goalId)
    .single();

  if (fetchError || !goal) {
    throw new Error("Goal not found");
  }

  const newBalance = (goal.currentBalance || 0) + amount;

  const { data: updatedGoal, error } = await supabase
    .from("Goal")
    .update({
      currentBalance: newBalance,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", goalId)
    .select()
    .single();

  if (error) {
    console.error("Supabase error topping up goal:", error);
    throw new Error(`Failed to top up goal: ${error.message || JSON.stringify(error)}`);
  }

  return updatedGoal;
}

/**
 * Withdraw from a goal (remove money)
 */
export async function withdrawFromGoalClient(goalId: string, amount: number): Promise<Goal> {
  const { data: goal, error: fetchError } = await supabase
    .from("Goal")
    .select("currentBalance")
    .eq("id", goalId)
    .single();

  if (fetchError || !goal) {
    throw new Error("Goal not found");
  }

  const newBalance = Math.max(0, (goal.currentBalance || 0) - amount);

  const { data: updatedGoal, error } = await supabase
    .from("Goal")
    .update({
      currentBalance: newBalance,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", goalId)
    .select()
    .single();

  if (error) {
    console.error("Supabase error withdrawing from goal:", error);
    throw new Error(`Failed to withdraw from goal: ${error.message || JSON.stringify(error)}`);
  }

  return updatedGoal;
}

/**
 * Ensure emergency fund goal exists for current user
 */
export async function ensureEmergencyFundGoalClient(): Promise<void> {
  const res = await fetch("/api/goals/ensure-emergency-fund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || "Failed to ensure emergency fund goal");
  }
}

