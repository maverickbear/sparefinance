"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";
import { formatTimestamp, formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { requireBudgetOwnership } from "@/lib/utils/security";
import { decryptAmount } from "@/lib/utils/transaction-encryption";

export interface Budget {
  id: string;
  period: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  macroId?: string | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  note?: string | null;
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  displayName?: string;
  category?: {
    id: string;
    name: string;
    macroId?: string;
    macro?: { id: string; name: string } | null;
  } | null;
  subcategory?: { id: string; name: string } | null;
  macro?: { id: string; name: string } | null;
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
}

async function getBudgetsInternal(period: Date, accessToken?: string, refreshToken?: string) {
    const supabase = await createServerClient(accessToken, refreshToken);

  const startOfMonth = new Date(period.getFullYear(), period.getMonth(), 1);
  const endOfMonth = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59);

  const { data: budgets, error } = await supabase
    .from("Budget")
    .select(`
      *,
      category:Category(
        *,
        macro:Group(*)
      ),
      macro:Group(*),
      subcategory:Subcategory(
        *
      ),
      budgetCategories:BudgetCategory(
        category:Category(
          *
        )
      ),
      budgetSubcategories:BudgetSubcategory(
        subcategory:Subcategory(
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
    const categoryMacro = category && Array.isArray(category.macro) ? category.macro[0] : category?.macro;
    const macro = Array.isArray(budget.macro) ? budget.macro[0] : budget.macro;
    const subcategory = Array.isArray(budget.subcategory) ? budget.subcategory[0] : budget.subcategory;
    const budgetCategories = Array.isArray(budget.budgetCategories) ? budget.budgetCategories : [];
    
    return {
      ...budget,
      category: category ? {
        ...category,
        macro: categoryMacro || null,
      } : null,
      macro: macro || null,
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
    
    if (budget.macroId && budget.budgetCategories && budget.budgetCategories.length > 0) {
      // Budget grouped by macro: sum transactions from all related categories
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

      // For grouped budgets, use macro name; for single category, use category name
      const displayName = budget.macro?.name || budget.category?.name || "Unknown";
      const displayCategory = budget.macro ? {
        id: budget.macroId,
        name: budget.macro.name,
        macroId: budget.macro.id,
        macro: budget.macro,
      } : (budget.category || { id: budget.categoryId, name: "Unknown", macroId: "", macro: null });

    return {
      ...budget,
      actualSpend,
      percentage,
      status,
      category: displayCategory,
      displayName,
      macro: budget.macro || null,
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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
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
  macroId?: string;
  categoryIds?: string[];
  subcategoryIds?: string[];
  amount: number;
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

  // If multiple categories are provided, create a grouped budget with macroId
  const isGrouped = data.categoryIds && data.categoryIds.length > 1;
  
  if (isGrouped && !data.macroId) {
    throw new Error("macroId is required when creating a grouped budget");
  }

  // Create the budget
  const budgetData: Record<string, unknown> = {
    id,
    period: periodDate,
    amount: data.amount,
    userId: user.id,
    createdAt: now,
    updatedAt: now,
  };

  if (isGrouped) {
    // Grouped budget: use macroId, categoryId is null
    budgetData.macroId = data.macroId;
    budgetData.categoryId = null;
    budgetData.subcategoryId = null; // Grouped budgets don't have subcategories
  } else {
    // Single category budget: use categoryId
    // For single category budgets, we DON'T save macroId to avoid conflicts with Budget_period_macroId_key constraint
    // The macroId is only used for grouped budgets
    budgetData.categoryId = data.categoryId || data.categoryIds?.[0];
    budgetData.macroId = null; // Don't save macroId for single category budgets
    // Use subcategoryId if provided (now we only support single subcategory)
    budgetData.subcategoryId = data.subcategoryId || (data.subcategoryIds && data.subcategoryIds.length > 0 ? data.subcategoryIds[0] : null);
  }

  const { data: budget, error } = await supabase
    .from("Budget")
    .insert(budgetData)
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating budget:", error);
    // Check if it's a unique constraint violation (budget already exists)
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      if (isGrouped) {
        throw new Error(`Budget already exists for this group in this period`);
      } else if (data.subcategoryId || (data.subcategoryIds && data.subcategoryIds.length > 0)) {
        throw new Error(`Budget already exists for this category and subcategory in this period`);
      } else {
        throw new Error(`Budget already exists for this category in this period`);
      }
    }
    throw new Error(`Failed to create budget: ${error.message || JSON.stringify(error)}`);
  }

  // If grouped, create BudgetCategory relationships
  if (isGrouped && data.categoryIds && data.categoryIds.length > 0) {
    const budgetCategories = data.categoryIds.map((categoryId) => ({
      id: crypto.randomUUID(),
      budgetId: budget.id,
      categoryId,
      createdAt: now,
    }));

    const { error: bcError } = await supabase
      .from("BudgetCategory")
      .insert(budgetCategories);

    if (bcError) {
      console.error("Supabase error creating budget categories:", bcError);
      // Try to clean up the budget if category creation fails
      await supabase.from("Budget").delete().eq("id", budget.id);
      throw new Error(`Failed to create budget categories: ${bcError.message || JSON.stringify(bcError)}`);
    }
  }

  // Note: subcategoryId is now stored directly in Budget, not in BudgetSubcategory

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('budgets', 'max');
  revalidateTag('dashboard', 'max');

  return budget;
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
  revalidateTag('budgets', 'max');
  revalidateTag('dashboard', 'max');

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
  revalidateTag('budgets', 'max');
  revalidateTag('dashboard', 'max');
}
