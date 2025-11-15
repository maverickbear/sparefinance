"use client";

import { supabase } from "@/lib/supabase";
import { formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { decryptAmount } from "@/lib/utils/transaction-encryption";

export interface Budget {
  id: string;
  period: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  macroId?: string | null;
  isRecurring?: boolean;
  actualSpend?: number;
  category?: { id: string; name: string; macro?: { id: string; name: string } } | null;
  subcategory?: { id: string; name: string } | null;
  macro?: { id: string; name: string } | null;
  budgetCategories?: Array<{ category: { id: string; name: string } }>;
}

/**
 * Get budgets for a specific period
 */
export async function getBudgetsClient(period: Date): Promise<Budget[]> {
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
      )
    `)
    .gte("period", formatDateStart(startOfMonth))
    .lte("period", formatDateEnd(endOfMonth));

  if (error) {
    console.error("Supabase error fetching budgets:", error);
    return [];
  }

  if (!budgets) {
    return [];
  }

  // Handle relations
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

  // Calculate actual spend for each budget
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

    return {
      ...budget,
      actualSpend,
      percentage,
      status,
      displayName,
    };
  });

  return budgetsWithActual;
}

/**
 * Delete a budget
 */
export async function deleteBudgetClient(id: string): Promise<void> {
  const { error } = await supabase.from("Budget").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting budget:", error);
    throw new Error(`Failed to delete budget: ${error.message || JSON.stringify(error)}`);
  }
}

