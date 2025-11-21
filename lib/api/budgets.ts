"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { requireBudgetOwnership } from "@/lib/utils/security";
import { decryptAmount } from "@/lib/utils/transaction-encryption";
import { getActiveHouseholdId } from "@/lib/utils/household";

export interface Budget {
  id: string;
  period: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  groupId?: string | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  note?: string | null;
  isRecurring?: boolean;
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  displayName?: string;
  category?: {
    id: string;
    name: string;
    groupId?: string;
    group?: { id: string; name: string } | null;
  } | null;
  subcategory?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
  budgetCategories?: Array<{
    id: string;
    budgetId: string;
    categoryId: string;
    createdAt?: string;
    category?: { id: string; name: string } | null;
  }>;
  budgetSubcategories?: Array<{
    id: string;
    budgetId: string;
    subcategoryId: string;
    createdAt?: string;
    subcategory?: { id: string; name: string } | null;
  }>;
  // Deprecated: Use groupId and group instead
  macroId?: string | null;
  macro?: { id: string; name: string } | null;
}

/**
 * Creates future budgets from recurring budgets if they don't exist yet
 * This is called automatically when viewing future months
 */
async function ensureRecurringBudgetsForPeriod(
  period: Date,
  supabase: any
): Promise<void> {
  const targetPeriod = new Date(period.getFullYear(), period.getMonth(), 1);
  const targetPeriodStr = formatTimestamp(targetPeriod);
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Find the most recent recurring budget for each category/group/subcategory combination
  // We need to get the latest budget for each unique combination
  // OPTIMIZED: Select only necessary fields instead of * to reduce payload size
  const { data: allRecurringBudgets } = await supabase
    .from("Budget")
    .select("id, amount, period, categoryId, groupId, subcategoryId, isRecurring, createdAt, updatedAt, userId, householdId")
    .eq("userId", user.id)
    .eq("isRecurring", true)
    .lt("period", targetPeriodStr)
    .order("period", { ascending: false });

  if (!allRecurringBudgets || allRecurringBudgets.length === 0) {
    return;
  }

  // Group by unique key and get the most recent one for each
  const recurringBudgetsMap = new Map<string, any>();
  for (const budget of allRecurringBudgets) {
    const key = budget.groupId 
      ? `group:${budget.groupId}` 
      : budget.subcategoryId 
        ? `cat:${budget.categoryId}:sub:${budget.subcategoryId}` 
        : `cat:${budget.categoryId}`;
    
    // Only keep the most recent budget for each key
    if (!recurringBudgetsMap.has(key)) {
      recurringBudgetsMap.set(key, budget);
    }
  }

  const recurringBudgets = Array.from(recurringBudgetsMap.values());

  // Check which budgets already exist for the target period
  const { data: existingBudgets } = await supabase
    .from("Budget")
    .select("id, categoryId, subcategoryId, groupId")
    .eq("userId", user.id)
    .eq("period", targetPeriodStr);

  const existingKeys = new Set(
    (existingBudgets || []).map((b: any) => 
      b.groupId ? `group:${b.groupId}` : 
      b.subcategoryId ? `cat:${b.categoryId}:sub:${b.subcategoryId}` : 
      `cat:${b.categoryId}`
    )
  );

  // Create missing budgets for this period
  const budgetsToCreate: Array<Record<string, unknown>> = [];
  const budgetCategoryRelations: Array<{ id: string; budgetId: string; categoryId: string; createdAt: string }> = [];
  const now = formatTimestamp(new Date());

  for (const recurringBudget of recurringBudgets as any[]) {
    const key = recurringBudget.groupId 
      ? `group:${recurringBudget.groupId}` 
      : recurringBudget.subcategoryId 
        ? `cat:${recurringBudget.categoryId}:sub:${recurringBudget.subcategoryId}` 
        : `cat:${recurringBudget.categoryId}`;

    // Skip if budget already exists for this period
    if (existingKeys.has(key)) {
      continue;
    }

    const budgetId = crypto.randomUUID();
    const budgetData: Record<string, unknown> = {
      id: budgetId,
      period: targetPeriodStr,
      amount: recurringBudget.amount,
      userId: user.id,
      categoryId: recurringBudget.categoryId,
      subcategoryId: recurringBudget.subcategoryId,
      groupId: recurringBudget.groupId,
      isRecurring: true,
      createdAt: now,
      updatedAt: now,
    };

    budgetsToCreate.push(budgetData);

    // If it's a grouped budget, we need to get the BudgetCategory relations
    if (recurringBudget.groupId) {
      const { data: budgetCategories } = await supabase
        .from("BudgetCategory")
        .select("categoryId")
        .eq("budgetId", recurringBudget.id);

      if (budgetCategories) {
        for (const bc of budgetCategories) {
          budgetCategoryRelations.push({
            id: crypto.randomUUID(),
            budgetId,
            categoryId: bc.categoryId,
            createdAt: now,
          });
        }
      }
    }
  }

  // Insert budgets if any
  if (budgetsToCreate.length > 0) {
    const { error } = await supabase
      .from("Budget")
      .insert(budgetsToCreate);

    if (error) {
      console.error("Error creating recurring budgets:", error);
      return;
    }

    // Create BudgetCategory relations for grouped budgets
    if (budgetCategoryRelations.length > 0) {
      await supabase
        .from("BudgetCategory")
        .insert(budgetCategoryRelations);
    }
  }
}

export async function getBudgetsInternal(period: Date, accessToken?: string, refreshToken?: string) {
    const supabase = await createServerClient(accessToken, refreshToken);

  // Ensure recurring budgets exist for this period (creates them on-demand)
  await ensureRecurringBudgetsForPeriod(period, supabase);

  const startOfMonth = new Date(period.getFullYear(), period.getMonth(), 1);
  const endOfMonth = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59);

  const { data: budgets, error } = await supabase
    .from("Budget")
    .select(`
      *,
      category:Category(
        *,
        group:Group(*)
      ),
      group:Group(*),
      subcategory:Subcategory(
        *
      ),
      budgetCategories:BudgetCategory(
        category:Category(
          *
        )
      )
    `)
    .gte("period", formatDateStart(startOfMonth))
    .lte("period", formatDateEnd(endOfMonth));

  if (error) {
    console.error("Supabase error fetching budgets:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  if (!budgets) {
    return [];
  }

  // Supabase returns relations as arrays, so we need to handle that
  const processedBudgets = budgets.map((budget: any) => {
    const category = Array.isArray(budget.category) ? budget.category[0] : budget.category;
    const categoryGroup = category && Array.isArray(category.group) ? category.group[0] : category?.group;
    const group = Array.isArray(budget.group) ? budget.group[0] : budget.group;
    const subcategory = Array.isArray(budget.subcategory) ? budget.subcategory[0] : budget.subcategory;
    const budgetCategories = Array.isArray(budget.budgetCategories) ? budget.budgetCategories : [];
    
    return {
      ...budget,
      category: category ? {
        ...category,
        group: categoryGroup || null,
      } : null,
      group: group || null,
      // Backward compatibility
      macro: categoryGroup || null,
      macroId: budget.groupId || null,
      subcategory: subcategory || null,
      budgetCategories: budgetCategories.map((bc: any) => ({
        ...bc,
        category: Array.isArray(bc.category) ? bc.category[0] : bc.category,
      })),
    };
  });

  // Fetch all transactions for the period once
  const { data: allTransactions } = await supabase
    .from("Transaction")
    .select("categoryId, subcategoryId, amount")
    .eq("type", "expense")
    .gte("date", formatDateStart(startOfMonth))
    .lte("date", formatDateEnd(endOfMonth));

  // Create maps for quick lookup
  // Map for categoryId -> total amount (all transactions in that category)
  const categorySpendMap = new Map<string, number>();
  // Map for categoryId+subcategoryId -> total amount (transactions with specific subcategory)
  const categorySubcategorySpendMap = new Map<string, number>();
  
  if (allTransactions) {
    for (const tx of allTransactions) {
      if (tx.categoryId) {
        // Decrypt amount if encrypted, then ensure it's a positive number (expenses should be positive)
        const decryptedAmount = decryptAmount(tx.amount);
        const amount = Math.abs(decryptedAmount || 0);
        
        // Add to category total (all transactions in this category)
        const currentCategoryTotal = categorySpendMap.get(tx.categoryId) || 0;
        categorySpendMap.set(tx.categoryId, currentCategoryTotal + amount);
        
        // If subcategoryId exists, also add to category+subcategory map
        if (tx.subcategoryId) {
          const key = `${tx.categoryId}:${tx.subcategoryId}`;
          const currentSubcategoryTotal = categorySubcategorySpendMap.get(key) || 0;
          categorySubcategorySpendMap.set(key, currentSubcategoryTotal + amount);
        }
      }
    }
  }

  // Calculate actual spend for each budget using the pre-fetched data
  const budgetsWithActual = processedBudgets.map((budget) => {
    let actualSpend = 0;
    
    if (budget.groupId && budget.budgetCategories && budget.budgetCategories.length > 0) {
      // Budget grouped by group: sum transactions from all related categories
      // Note: Grouped budgets don't have subcategories, so we sum all transactions from those categories
      const categoryIds = budget.budgetCategories
        .map((bc: any) => bc.category?.id)
        .filter((id: string) => id);
      
      for (const categoryId of categoryIds) {
        actualSpend += categorySpendMap.get(categoryId) || 0;
      }
    } else if (budget.categoryId) {
      // Single category budget
      if (budget.subcategoryId) {
        // Budget with subcategory: sum only transactions with this specific category+subcategory
        const key = `${budget.categoryId}:${budget.subcategoryId}`;
        actualSpend = categorySubcategorySpendMap.get(key) || 0;
      } else {
        // Budget without subcategory: sum all transactions from this category
        actualSpend = categorySpendMap.get(budget.categoryId) || 0;
      }
    }

    // Calculate percentage as budget USED (increases as money is spent)
    // If actualSpend >= budget.amount, percentage >= 100 (budget exceeded)
    const remaining = Math.max(0, budget.amount - actualSpend);
    const percentage = budget.amount > 0 ? (actualSpend / budget.amount) * 100 : 0;

      let status: "ok" | "warning" | "over" = "ok";
      if (actualSpend >= budget.amount) {
        status = "over";
      } else if (percentage >= 90) {
        // 90% or more used (less than 10% remaining)
        status = "warning";
      }

      // For grouped budgets, use group name; for single category, use category name
      const displayName = budget.group?.name || budget.category?.name || "Unknown";
      const displayCategory = budget.group ? {
        id: budget.groupId,
        name: budget.group.name,
        groupId: budget.group.id,
        group: budget.group,
      } : (budget.category || { id: budget.categoryId, name: "Unknown", groupId: "", group: null });

    return {
      ...budget,
      actualSpend,
      percentage,
      status,
      category: displayCategory,
      displayName,
      group: budget.group || null,
      // Backward compatibility
      macro: budget.group || null,
      macroId: budget.groupId || null,
      budgetCategories: budget.budgetCategories || [],
    };
  });

  return budgetsWithActual;
}

export async function getBudgets(period: Date) {
  // Get tokens from Supabase client directly (not from cookies)
  // This is more reliable because Supabase SSR manages cookies automatically
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Only get session tokens if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
    
  } catch (error: any) {
    // If we can't get tokens (e.g., inside unstable_cache), continue without them
    console.warn("⚠️ [getBudgets] Could not get tokens:", error?.message);
  }
  
  const cacheKey = `budgets-${period.getFullYear()}-${period.getMonth()}`;
  return unstable_cache(
    async () => getBudgetsInternal(period, accessToken, refreshToken),
    [cacheKey],
    { revalidate: 60, tags: ['budgets', 'transactions'] }
  )();
}

export async function createBudget(data: {
  period: Date;
  categoryId?: string;
  subcategoryId?: string;
  groupId?: string;
  categoryIds?: string[];
  subcategoryIds?: string[];
  amount: number;
  // Deprecated: Use groupId instead
  macroId?: string;
  // If false, creates only the budget for the specified period (default: true)
  isRecurring?: boolean;
}) {
    const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const id = crypto.randomUUID();
  const startOfMonth = new Date(data.period.getFullYear(), data.period.getMonth(), 1);
  const periodDate = formatTimestamp(startOfMonth);
  const now = formatTimestamp(new Date());

  // If multiple categories are provided, create a grouped budget with groupId
  const isGrouped = data.categoryIds && data.categoryIds.length > 1;
  
  // Support both groupId and deprecated macroId for backward compatibility
  const groupId = data.groupId || data.macroId;
  
  if (isGrouped && !groupId) {
    throw new Error("groupId is required when creating a grouped budget");
  }

  // Budgets are automatically set as recurring monthly (unless explicitly set to false)
  // By default, create only 1 budget with isRecurring=true, which can be used to generate future budgets on-demand
  const isRecurring = data.isRecurring !== false; // Default to true if not specified

  // Always create only 1 budget (the flag isRecurring indicates it should be replicated for future months)
  // Future budgets can be created on-demand when viewing future months
  const periodDates: string[] = [];
  const monthsToCreate = 1; // Always create only 1 budget
  
  for (let monthOffset = 0; monthOffset < monthsToCreate; monthOffset++) {
    const targetDate = new Date(data.period.getFullYear(), data.period.getMonth() + monthOffset, 1);
    periodDates.push(formatTimestamp(targetDate));
  }

  // Check if budgets already exist for any of these periods (single query)
  let existingBudgetsQuery = supabase
    .from("Budget")
    .select("period")
    .eq("userId", user.id)
    .in("period", periodDates);

  if (isGrouped) {
    existingBudgetsQuery = existingBudgetsQuery.eq("groupId", groupId).is("categoryId", null);
  } else {
    const categoryId = data.categoryId || data.categoryIds?.[0];
    existingBudgetsQuery = existingBudgetsQuery.eq("categoryId", categoryId);
    if (data.subcategoryId || (data.subcategoryIds && data.subcategoryIds.length > 0)) {
      const subcategoryId = data.subcategoryId || (data.subcategoryIds?.[0]);
      existingBudgetsQuery = existingBudgetsQuery.eq("subcategoryId", subcategoryId);
    } else {
      existingBudgetsQuery = existingBudgetsQuery.is("subcategoryId", null);
    }
  }

  const { data: existingBudgets } = await existingBudgetsQuery;
  const existingPeriods = new Set((existingBudgets || []).map((b: { period: string }) => b.period));

  // Check if budget already exists for the current month (must not exist)
  const currentPeriodDate = periodDates[0];
  if (existingPeriods.has(currentPeriodDate)) {
    if (isGrouped) {
      throw new Error(`Budget already exists for this group in this period`);
    } else if (data.subcategoryId || (data.subcategoryIds && data.subcategoryIds.length > 0)) {
      throw new Error(`Budget already exists for this category and subcategory in this period`);
    } else {
      throw new Error(`Budget already exists for this category in this period`);
    }
  }

  // Create budgets for the specified period(s) (skip existing ones)
  const budgetsToCreate: Array<Record<string, unknown>> = [];
  // Get active household ID
  const householdId = await getActiveHouseholdId(user.id);
  if (!householdId) {
    throw new Error("No active household found. Please contact support.");
  }

  const budgetCategoryRelations: Array<{ id: string; budgetId: string; categoryId: string; createdAt: string }> = [];

  for (let monthOffset = 0; monthOffset < monthsToCreate; monthOffset++) {
    const targetDate = new Date(data.period.getFullYear(), data.period.getMonth() + monthOffset, 1);
    const targetPeriodDate = formatTimestamp(targetDate);

    // Skip if budget already exists for this period
    if (existingPeriods.has(targetPeriodDate)) {
      continue;
    }

    // Create the budget data
    const budgetData: Record<string, unknown> = {
      id: monthOffset === 0 ? id : crypto.randomUUID(), // Use provided ID for first month
      period: targetPeriodDate,
      amount: data.amount,
      userId: user.id,
      householdId: householdId, // Add householdId for household-based architecture
      createdAt: now,
      updatedAt: now,
      isRecurring: isRecurring,
    };

    if (isGrouped) {
      // Grouped budget: use groupId, categoryId is null
      budgetData.groupId = groupId;
      budgetData.categoryId = null;
      budgetData.subcategoryId = null; // Grouped budgets don't have subcategories
    } else {
      // Single category budget: use categoryId
      // For single category budgets, we DON'T save groupId to avoid conflicts with Budget_period_groupId_key constraint
      // The groupId is only used for grouped budgets
      budgetData.categoryId = data.categoryId || data.categoryIds?.[0];
      budgetData.groupId = null; // Don't save groupId for single category budgets
      // Use subcategoryId if provided (now we only support single subcategory)
      budgetData.subcategoryId = data.subcategoryId || (data.subcategoryIds && data.subcategoryIds.length > 0 ? data.subcategoryIds[0] : null);
    }

    budgetsToCreate.push(budgetData);

    // Prepare BudgetCategory relationships for grouped budgets
    if (isGrouped && data.categoryIds && data.categoryIds.length > 0) {
      for (const categoryId of data.categoryIds) {
        budgetCategoryRelations.push({
          id: crypto.randomUUID(),
          budgetId: budgetData.id as string,
          categoryId,
          createdAt: now,
        });
      }
    }
  }

  // Only insert if there are budgets to create
  if (budgetsToCreate.length === 0) {
    const errorMessage = isRecurring 
      ? "All budgets for the next 12 months already exist"
      : "Budget already exists for this period";
    throw new Error(errorMessage);
  }

  // Insert all budgets at once
  const { data: createdBudgets, error } = await supabase
    .from("Budget")
    .insert(budgetsToCreate)
    .select();

  if (error) {
    console.error("Supabase error creating budgets:", error);
    throw new Error(`Failed to create budgets: ${error.message || JSON.stringify(error)}`);
  }

  // If grouped, create BudgetCategory relationships for all created budgets
  if (isGrouped && budgetCategoryRelations.length > 0) {
    const { error: bcError } = await supabase
      .from("BudgetCategory")
      .insert(budgetCategoryRelations);

    if (bcError) {
      console.error("Supabase error creating budget categories:", bcError);
      // Try to clean up the budgets if category creation fails
      if (createdBudgets && createdBudgets.length > 0) {
        const budgetIds = createdBudgets.map(b => b.id);
        await supabase.from("Budget").delete().in("id", budgetIds);
      }
      throw new Error(`Failed to create budget categories: ${bcError.message || JSON.stringify(bcError)}`);
    }
  }

  // Note: subcategoryId is now stored directly in Budget, not in BudgetSubcategory

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateBudgetCaches } = await import('@/lib/services/cache-manager');
  invalidateBudgetCaches();

  // Return the first budget (current month)
  return createdBudgets?.[0] || null;
}

export async function updateBudget(id: string, data: { amount: number }) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireBudgetOwnership(id);

  const updateData: Record<string, unknown> = {
    amount: data.amount,
    updatedAt: formatTimestamp(new Date()),
  };

  const { data: budget, error } = await supabase
    .from("Budget")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating budget:", error);
    throw new Error(`Failed to update budget: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateBudgetCaches } = await import('@/lib/services/cache-manager');
  invalidateBudgetCaches();

  return budget;
}

export async function deleteBudget(id: string) {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireBudgetOwnership(id);

  const { error } = await supabase.from("Budget").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting budget:", error);
    throw new Error(`Failed to delete budget: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  const { invalidateBudgetCaches } = await import('@/lib/services/cache-manager');
  invalidateBudgetCaches();
}
