/**
 * Budgets Service
 * Business logic for budget management
 */

import { BudgetsRepository } from "@/src/infrastructure/database/repositories/budgets.repository";
import { BudgetsMapper } from "./budgets.mapper";
import { BudgetFormData } from "../../domain/budgets/budgets.validations";
import { BaseBudget, BudgetWithRelations } from "../../domain/budgets/budgets.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { requireBudgetOwnership } from "@/lib/utils/security";
import { logger } from "@/lib/utils/logger";
import { invalidateBudgetCaches } from "@/src/infrastructure/cache/cache.manager";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";

export class BudgetsService {
  constructor(private repository: BudgetsRepository) {}

  /**
   * Get budgets for a period
   */
  async getBudgets(
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetWithRelations[]> {
    const supabase = await createServerClient(accessToken, refreshToken);

    // Ensure recurring budgets are created for this period
    await this.ensureRecurringBudgetsForPeriod(period, supabase);

    // Fetch budgets
    const rows = await this.repository.findAllByPeriod(period, accessToken, refreshToken);

    // Fetch related data
    const categoryIds = [...new Set(rows.map(b => b.categoryId).filter(Boolean) as string[])];
    const subcategoryIds = [...new Set(rows.map(b => b.subcategoryId).filter(Boolean) as string[])];
    const groupIds = [...new Set(rows.map(b => b.groupId).filter(Boolean) as string[])];

    // Fetch categories, subcategories, and groups
    const [categoriesResult, subcategoriesResult, groupsResult] = await Promise.all([
      categoryIds.length > 0
        ? supabase.from("Category").select("id, name, groupId").in("id", categoryIds)
        : Promise.resolve({ data: null }),
      subcategoryIds.length > 0
        ? supabase.from("Subcategory").select("id, name").in("id", subcategoryIds)
        : Promise.resolve({ data: null }),
      groupIds.length > 0
        ? supabase.from("Group").select("id, name").in("id", groupIds)
        : Promise.resolve({ data: null }),
    ]);

    const categoriesMap = new Map();
    categoriesResult.data?.forEach((cat: any) => {
      categoriesMap.set(cat.id, cat);
    });

    const subcategoriesMap = new Map();
    subcategoriesResult.data?.forEach((sub: any) => {
      subcategoriesMap.set(sub.id, sub);
    });

    const groupsMap = new Map();
    groupsResult.data?.forEach((group: any) => {
      groupsMap.set(group.id, group);
    });

    // Calculate actual spend for each budget
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return rows.map(row => BudgetsMapper.toDomainWithRelations(row));
    }

    // Get transactions for the period - only fetch once
    // OPTIMIZATION: Only select necessary fields and filter by expense type at database level
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    const periodEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59);

    const { data: transactions } = await supabase
      .from("Transaction")
      .select("categoryId, subcategoryId, amount")
      .gte("date", periodStart.toISOString().split('T')[0])
      .lte("date", periodEnd.toISOString().split('T')[0])
      .eq("type", "expense")
      .not("categoryId", "is", null); // Only get transactions with categories to reduce data

    // OPTIMIZATION: Pre-calculate spend maps instead of filtering for each budget
    // This reduces complexity from O(n*m) to O(n+m) where n=transactions, m=budgets
    const categorySpendMap = new Map<string, number>();
    const subcategorySpendMap = new Map<string, number>();
    const groupSpendMap = new Map<string, number>();

    if (transactions) {
      for (const tx of transactions) {
        const amount = getTransactionAmount(tx.amount) || 0;
        const absAmount = Math.abs(amount);

        // Add to category spend
        if (tx.categoryId) {
          const currentCategoryTotal = categorySpendMap.get(tx.categoryId) || 0;
          categorySpendMap.set(tx.categoryId, currentCategoryTotal + absAmount);

          // Also add to group spend if category belongs to a group
          const category = categoriesMap.get(tx.categoryId);
          if (category?.groupId) {
            const currentGroupTotal = groupSpendMap.get(category.groupId) || 0;
            groupSpendMap.set(category.groupId, currentGroupTotal + absAmount);
          }
        }

        // Add to subcategory spend
        if (tx.subcategoryId) {
          const currentSubcategoryTotal = subcategorySpendMap.get(tx.subcategoryId) || 0;
          subcategorySpendMap.set(tx.subcategoryId, currentSubcategoryTotal + absAmount);
        }
      }
    }

    // Calculate actual spend per budget using pre-calculated maps
    const budgets: BudgetWithRelations[] = rows.map(row => {
      const category = row.categoryId ? categoriesMap.get(row.categoryId) : null;
      const subcategory = row.subcategoryId ? subcategoriesMap.get(row.subcategoryId) : null;
      const group = row.groupId ? groupsMap.get(row.groupId) : null;

      // Calculate actual spend using pre-calculated maps
      let actualSpend = 0;
      if (row.groupId) {
        // Group budget - use group spend map
        actualSpend = groupSpendMap.get(row.groupId) || 0;
      } else if (row.subcategoryId) {
        // Subcategory budget - use subcategory spend map
        actualSpend = subcategorySpendMap.get(row.subcategoryId) || 0;
      } else if (row.categoryId) {
        // Category budget - use category spend map
        actualSpend = categorySpendMap.get(row.categoryId) || 0;
      }

      const percentage = row.amount > 0 ? (actualSpend / row.amount) * 100 : 0;
      const status: "ok" | "warning" | "over" = 
        percentage >= 100 ? "over" : 
        percentage >= 80 ? "warning" : 
        "ok";

      return BudgetsMapper.toDomainWithRelations(row, {
        category: category ? { ...category, group: group ? { id: group.id, name: group.name } : null } : null,
        subcategory: subcategory || null,
        group: group ? { id: group.id, name: group.name } : null,
        actualSpend,
        percentage,
        status,
      });
    });

    return budgets;
  }

  /**
   * Get budget by ID
   */
  async getBudgetById(
    id: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetWithRelations | null> {
    const row = await this.repository.findById(id, accessToken, refreshToken);
    
    if (!row) {
      return null;
    }

    // Fetch relations
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const [categoryResult, subcategoryResult, groupResult] = await Promise.all([
      row.categoryId ? supabase.from("Category").select("id, name, groupId").eq("id", row.categoryId).single() : Promise.resolve({ data: null }),
      row.subcategoryId ? supabase.from("Subcategory").select("id, name").eq("id", row.subcategoryId).single() : Promise.resolve({ data: null }),
      row.groupId ? supabase.from("Group").select("id, name").eq("id", row.groupId).single() : Promise.resolve({ data: null }),
    ]);

    return BudgetsMapper.toDomainWithRelations(row, {
      category: categoryResult.data ? { ...categoryResult.data, group: null } : null,
      subcategory: subcategoryResult.data || null,
      group: groupResult.data ? { id: groupResult.data.id, name: groupResult.data.name } : null,
    });
  }

  /**
   * Create a new budget
   */
  async createBudget(data: BudgetFormData): Promise<BaseBudget> {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Format period
    const periodDate = data.period instanceof Date ? data.period : new Date(data.period);
    const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    const periodStr = formatTimestamp(periodStart);

    // Support both groupId and deprecated macroId
    const groupId = data.groupId || data.macroId || null;

    // Check if budget already exists
    const exists = await this.repository.existsForPeriod(
      periodStr,
      data.categoryId || null,
      data.subcategoryId || null,
      groupId,
      user.id
    );

    if (exists) {
      throw new Error("Budget already exists for this period and category");
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());
    const householdId = await getActiveHouseholdId(user.id);

    const budgetRow = await this.repository.create({
      id,
      period: periodStr,
      amount: data.amount,
      categoryId: data.categoryId || null,
      subcategoryId: data.subcategoryId || null,
      groupId,
      userId: user.id,
      note: null,
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });

    // Invalidate cache
    invalidateBudgetCaches();

    return BudgetsMapper.toDomain(budgetRow);
  }

  /**
   * Check if a budget is pre-filled (created during onboarding)
   * Note: Currently budgets don't have a note field, so this is a placeholder
   * In the future, we could add a flag or use the note field to mark pre-filled budgets
   */
  isPreFilled(budget: BaseBudget): boolean {
    // For now, we can't determine if a budget is pre-filled
    // This method is here for future enhancement
    return false;
  }

  /**
   * Update a budget
   */
  async updateBudget(id: string, data: { amount: number }): Promise<BaseBudget> {
    // Verify ownership
    await requireBudgetOwnership(id);

    const now = formatTimestamp(new Date());

    const budgetRow = await this.repository.update(id, {
      amount: data.amount,
      updatedAt: now,
    });

    // Invalidate cache
    invalidateBudgetCaches();

    return BudgetsMapper.toDomain(budgetRow);
  }

  /**
   * Delete a budget
   */
  async deleteBudget(id: string): Promise<void> {
    // Verify ownership
    await requireBudgetOwnership(id);

    await this.repository.delete(id);

    // Invalidate cache
    invalidateBudgetCaches();
  }

  /**
   * Ensure recurring budgets are created for a period
   * OPTIMIZATION: Batch check existence and create in single operations
   */
  private async ensureRecurringBudgetsForPeriod(
    period: Date,
    supabase: any
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const targetPeriod = new Date(period.getFullYear(), period.getMonth(), 1);
    const targetPeriodStr = formatTimestamp(targetPeriod);

    // Get recurring budgets before this period
    const recurringBudgets = await this.repository.findRecurringBudgetsBeforePeriod(targetPeriod, user.id);

    if (recurringBudgets.length === 0) {
      return;
    }

    // Group by unique key and get the most recent one for each
    const recurringBudgetsMap = new Map<string, any>();
    for (const budget of recurringBudgets) {
      const key = budget.groupId 
        ? `group:${budget.groupId}` 
        : budget.subcategoryId 
          ? `cat:${budget.categoryId}:sub:${budget.subcategoryId}` 
          : `cat:${budget.categoryId}`;
      
      if (!recurringBudgetsMap.has(key)) {
        recurringBudgetsMap.set(key, budget);
      }
    }

    const uniqueRecurringBudgets = Array.from(recurringBudgetsMap.values());

    // OPTIMIZATION: Fetch all existing budgets for the period in a single query
    const { data: existingBudgets } = await supabase
      .from("Budget")
      .select("categoryId, subcategoryId, groupId")
      .eq("period", targetPeriodStr)
      .eq("userId", user.id);

    // Create a set of existing budget keys for O(1) lookup
    const existingKeys = new Set(
      (existingBudgets || []).map((b: any) => 
        b.groupId 
          ? `group:${b.groupId}` 
          : b.subcategoryId 
            ? `cat:${b.categoryId}:sub:${b.subcategoryId}` 
            : `cat:${b.categoryId}`
      )
    );

    // Filter out budgets that already exist
    const budgetsToCreate = uniqueRecurringBudgets.filter(budget => {
      const key = budget.groupId 
        ? `group:${budget.groupId}` 
        : budget.subcategoryId 
          ? `cat:${budget.categoryId}:sub:${budget.subcategoryId}` 
          : `cat:${budget.categoryId}`;
      return !existingKeys.has(key);
    });
    
    if (budgetsToCreate.length > 0) {
      const now = formatTimestamp(new Date());
      const householdId = await getActiveHouseholdId(user.id);

      // Create all missing budgets in parallel
      await Promise.all(
        budgetsToCreate.map(budget => {
          const newId = crypto.randomUUID();
          return this.repository.create({
            id: newId,
            period: targetPeriodStr,
            amount: budget.amount,
            categoryId: budget.categoryId,
            subcategoryId: budget.subcategoryId,
            groupId: budget.groupId,
            userId: user.id,
            note: budget.note,
            isRecurring: true,
            createdAt: now,
            updatedAt: now,
          });
        })
      );
    }
  }
}

