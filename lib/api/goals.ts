"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { startOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { getTransactions } from "./transactions";
import { calculateProgress as calculateGoalProgress } from "@/lib/utils/goals";
import { requireGoalOwnership } from "@/lib/utils/security";

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
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  monthlyContribution?: number;
  monthsToGoal?: number | null;
  progressPct?: number;
  incomeBasis?: number;
}

export interface GoalWithCalculations extends Goal {
  monthlyContribution: number;
  monthsToGoal: number | null;
  progressPct: number;
  incomeBasis: number;
}

/**
 * Calculate income basis from last 3 months of income transactions
 * or use expectedIncome if provided
 */
export async function calculateIncomeBasis(
  expectedIncome?: number | null,
  accessToken?: string,
  refreshToken?: string
): Promise<number> {
  if (expectedIncome && expectedIncome > 0) {
    return expectedIncome;
  }

    const supabase = await createServerClient(accessToken, refreshToken);
  const now = new Date();
  const currentMonth = startOfMonth(now);
  
  // Get last 3 months
  const months = eachMonthOfInterval({
    start: subMonths(currentMonth, 3),
    end: currentMonth,
  });

  const monthlyIncomes = await Promise.all(
    months.map(async (month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

      const { data: transactions, error } = await supabase
        .from("Transaction")
        .select("amount")
        .eq("type", "income")
        .gte("date", formatDateStart(monthStart))
        .lte("date", formatDateEnd(monthEnd));

      if (error) {
        console.error("Error fetching income transactions:", error);
        return 0;
      }

      return (transactions || []).reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
    })
  );

  // Calculate rolling average
  const totalIncome = monthlyIncomes.reduce((sum, income) => sum + income, 0);
  const avgIncome = monthlyIncomes.length > 0 ? totalIncome / monthlyIncomes.length : 0;

  return avgIncome;
}


/**
 * Validate that total allocation across active goals doesn't exceed 100%
 */
export async function validateAllocation(
  goalId: string | null,
  incomePercentage: number
): Promise<{ valid: boolean; total: number; message?: string }> {
    const supabase = await createServerClient();

  // Get all active goals (not completed, not paused)
  const { data: goals, error } = await supabase
    .from("Goal")
    .select("id, incomePercentage, isCompleted, isPaused")
    .eq("isCompleted", false)
    .eq("isPaused", false);

  if (error) {
    console.error("Error fetching goals for validation:", error);
    throw new Error("Failed to validate allocation");
  }

  // Calculate total allocation
  let total = 0;
  if (goals) {
    for (const goal of goals) {
      // Exclude the goal being edited/created
      if (goal.id !== goalId) {
        total += goal.incomePercentage || 0;
      }
    }
  }

  // Add the new/updated goal's percentage
  total += incomePercentage;

  if (total > 100) {
    return {
      valid: false,
      total,
      message: `Total allocation cannot exceed 100%. Current total: ${total.toFixed(2)}%`,
    };
  }

  return {
    valid: true,
    total,
  };
}

/**
 * Get all goals with calculated progress, ETA, and monthly contribution
 */
export async function getGoalsInternal(accessToken?: string, refreshToken?: string): Promise<GoalWithCalculations[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

  // Get current user to verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("[GOALS] Authentication error:", authError);
    return [];
  }
  console.log("[GOALS] Fetching goals for user:", user.id);

  const { data: goals, error } = await supabase
    .from("Goal")
    .select("*")
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("[GOALS] Supabase error fetching goals:", error);
    return [];
  }

  console.log("[GOALS] Raw goals from database:", goals?.length || 0);

  if (!goals || goals.length === 0) {
    return [];
  }

  // Calculate income basis (use expectedIncome from first goal if available, or calculate from transactions)
  // For now, we'll calculate from transactions. Expected income can be stored per goal or globally
  const incomeBasis = await calculateIncomeBasis(undefined, accessToken, refreshToken);

  // Calculate progress for each goal
  const goalsWithCalculations: GoalWithCalculations[] = goals.map((goal: any) => {
    // Check if goal is completed (currentBalance >= targetAmount)
    const isCompleted = goal.currentBalance >= goal.targetAmount;
    
    // Update isCompleted if needed
    if (isCompleted && !goal.isCompleted) {
      // We'll update this in the database, but for now just use it in calculations
      goal.isCompleted = isCompleted;
      if (!goal.completedAt) {
        goal.completedAt = formatTimestamp(new Date());
      }
    }

    // Use goal's expectedIncome if available, otherwise use calculated incomeBasis
    const goalIncomeBasis = goal.expectedIncome && goal.expectedIncome > 0
      ? goal.expectedIncome
      : incomeBasis;

    const progress = calculateGoalProgress(goal, goalIncomeBasis);

    return {
      ...goal,
      isCompleted,
      ...progress,
      incomeBasis: goalIncomeBasis,
    };
  });

  return goalsWithCalculations;
}

export async function getGoals(): Promise<GoalWithCalculations[]> {
  // Get tokens from Supabase client directly (not from cookies)
  // This is more reliable because Supabase SSR manages cookies automatically
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
    }
    
  } catch (error: any) {
    // If we can't get tokens (e.g., inside unstable_cache), continue without them
    console.warn("⚠️ [getGoals] Could not get tokens:", error?.message);
  }
  
  return unstable_cache(
    async () => getGoalsInternal(accessToken, refreshToken),
    ['goals'],
    { revalidate: 60, tags: ['goals', 'transactions'] }
  )();
}

/**
 * Create a new goal
 */
export async function createGoal(data: {
  name: string;
  targetAmount: number;
  currentBalance?: number;
  incomePercentage?: number;
  priority: "High" | "Medium" | "Low";
  description?: string;
  isPaused?: boolean;
  expectedIncome?: number;
  targetMonths?: number;
  accountId?: string;
  holdingId?: string;
}): Promise<Goal> {
    const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // If targetMonths is provided and incomePercentage is not, calculate incomePercentage
  let incomePercentage = data.incomePercentage || 0;
  if (data.targetMonths && data.targetMonths > 0 && (!data.incomePercentage || data.incomePercentage === 0)) {
    const incomeBasis = await calculateIncomeBasis(data.expectedIncome);
    if (incomeBasis > 0) {
      const { calculateIncomePercentageFromTargetMonths } = await import("@/lib/utils/goals");
      incomePercentage = calculateIncomePercentageFromTargetMonths(
        data.targetAmount,
        data.currentBalance || 0,
        data.targetMonths,
        incomeBasis
      );
    }
  }

  // Validate allocation
  if (incomePercentage > 0) {
    const validation = await validateAllocation(null, incomePercentage);
    if (!validation.valid) {
      throw new Error(validation.message || "Total allocation exceeds 100%");
    }
  }

  // Check if goal is already completed (startingBalance >= targetAmount)
  const isCompleted = (data.currentBalance || 0) >= data.targetAmount;

  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  const goalData: Record<string, unknown> = {
    id,
    name: data.name,
    targetAmount: data.targetAmount,
    currentBalance: data.currentBalance || 0,
    incomePercentage,
    priority: data.priority,
    description: data.description || null,
    isPaused: data.isPaused || false,
    isCompleted,
    completedAt: isCompleted ? now : null,
    expectedIncome: data.expectedIncome || null,
    targetMonths: data.targetMonths || null,
    accountId: data.accountId || null,
    holdingId: data.holdingId || null,
    userId: user.id,
    createdAt: now,
    updatedAt: now,
  };

  const { data: goal, error } = await supabase
    .from("Goal")
    .insert(goalData)
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating goal:", error);
    throw new Error(`Failed to create goal: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure fresh data on next fetch
  revalidateTag('goals', 'max');
  revalidateTag('dashboard', 'max');

  return goal;
}

/**
 * Update an existing goal
 */
export async function updateGoal(
  id: string,
  data: {
    name?: string;
    targetAmount?: number;
    currentBalance?: number;
    incomePercentage?: number;
    priority?: "High" | "Medium" | "Low";
    description?: string;
    isPaused?: boolean;
    expectedIncome?: number;
    targetMonths?: number;
    accountId?: string;
    holdingId?: string;
  }
): Promise<Goal> {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireGoalOwnership(id);

  // Get current goal
  const { data: currentGoal, error: fetchError } = await supabase
    .from("Goal")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !currentGoal) {
    throw new Error("Goal not found");
  }

  // Use provided currentBalance or keep existing one
  const effectiveCurrentBalance = data.currentBalance !== undefined ? data.currentBalance : currentGoal.currentBalance;

  // If targetMonths is provided and incomePercentage is not being updated, calculate incomePercentage
  let incomePercentage = data.incomePercentage;
  if (data.targetMonths && data.targetMonths > 0 && data.incomePercentage === undefined) {
    const targetAmount = data.targetAmount ?? currentGoal.targetAmount;
    const expectedIncome = data.expectedIncome ?? currentGoal.expectedIncome;
    const incomeBasis = await calculateIncomeBasis(expectedIncome);
    if (incomeBasis > 0) {
      const { calculateIncomePercentageFromTargetMonths } = await import("@/lib/utils/goals");
      incomePercentage = calculateIncomePercentageFromTargetMonths(
        targetAmount,
        effectiveCurrentBalance,
        data.targetMonths,
        incomeBasis
      );
    }
  }

  // Validate allocation if incomePercentage is being updated
  if (incomePercentage !== undefined) {
    const validation = await validateAllocation(id, incomePercentage);
    if (!validation.valid) {
      throw new Error(validation.message || "Total allocation exceeds 100%");
    }
  }

  // Check if goal should be marked as completed
  const targetAmount = data.targetAmount ?? currentGoal.targetAmount;
  const isCompleted = effectiveCurrentBalance >= targetAmount;

  const updateData: Record<string, unknown> = {
    updatedAt: formatTimestamp(new Date()),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
  if (data.currentBalance !== undefined) updateData.currentBalance = data.currentBalance;
  if (incomePercentage !== undefined) updateData.incomePercentage = incomePercentage;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.isPaused !== undefined) updateData.isPaused = data.isPaused;
  if (data.expectedIncome !== undefined) updateData.expectedIncome = data.expectedIncome || null;
  if (data.targetMonths !== undefined) updateData.targetMonths = data.targetMonths || null;
  if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
  if (data.holdingId !== undefined) updateData.holdingId = data.holdingId || null;

  // Update completion status
  updateData.isCompleted = isCompleted;
  if (isCompleted && !currentGoal.completedAt) {
    updateData.completedAt = formatTimestamp(new Date());
  } else if (!isCompleted && currentGoal.completedAt) {
    updateData.completedAt = null;
  }

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

  // Invalidate cache to ensure fresh data on next fetch
  revalidateTag('goals', 'max');
  revalidateTag('dashboard', 'max');

  return goal;
}

/**
 * Delete a goal
 */
export async function deleteGoal(id: string): Promise<void> {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireGoalOwnership(id);

  const { error } = await supabase.from("Goal").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting goal:", error);
    throw new Error(`Failed to delete goal: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure fresh data on next fetch
  revalidateTag('goals', 'max');
  revalidateTag('dashboard', 'max');
}

/**
 * Add a manual top-up to a goal
 */
export async function addTopUp(id: string, amount: number): Promise<Goal> {
  if (amount <= 0) {
    throw new Error("Top-up amount must be positive");
  }

    const supabase = await createServerClient();

  // Get current goal
  const { data: goal, error: fetchError } = await supabase
    .from("Goal")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !goal) {
    throw new Error("Goal not found");
  }

  const newBalance = (goal.currentBalance || 0) + amount;
  const isCompleted = newBalance >= goal.targetAmount;

  const updateData: Record<string, unknown> = {
    currentBalance: newBalance,
    isCompleted,
    updatedAt: formatTimestamp(new Date()),
  };

  if (isCompleted && !goal.completedAt) {
    updateData.completedAt = formatTimestamp(new Date());
  }

  const { data: updatedGoal, error } = await supabase
    .from("Goal")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error adding top-up:", error);
    throw new Error(`Failed to add top-up: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure fresh data on next fetch
  revalidateTag('goals', 'max');
  revalidateTag('dashboard', 'max');

  return updatedGoal;
}

/**
 * Withdraw from a goal
 */
export async function withdraw(id: string, amount: number): Promise<Goal> {
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be positive");
  }

    const supabase = await createServerClient();

  // Get current goal
  const { data: goal, error: fetchError } = await supabase
    .from("Goal")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !goal) {
    throw new Error("Goal not found");
  }

  const newBalance = Math.max(0, (goal.currentBalance || 0) - amount);
  const isCompleted = newBalance >= goal.targetAmount;

  const updateData: Record<string, unknown> = {
    currentBalance: newBalance,
    isCompleted,
    updatedAt: formatTimestamp(new Date()),
  };

  if (!isCompleted && goal.completedAt) {
    updateData.completedAt = null;
  }

  const { data: updatedGoal, error } = await supabase
    .from("Goal")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error withdrawing from goal:", error);
    throw new Error(`Failed to withdraw: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure fresh data on next fetch
  revalidateTag('goals', 'max');
  revalidateTag('dashboard', 'max');

  return updatedGoal;
}

