/**
 * Budgets Service
 * Business logic for budget management
 */

import { IBudgetsRepository } from "@/src/infrastructure/database/repositories/interfaces/budgets.repository.interface";
import { ICategoriesRepository } from "@/src/infrastructure/database/repositories/interfaces/categories.repository.interface";
import { ITransactionsRepository } from "@/src/infrastructure/database/repositories/interfaces/transactions.repository.interface";
import { BudgetsMapper } from "./budgets.mapper";
import { BudgetFormData } from "../../domain/budgets/budgets.validations";
import { BaseBudget, BudgetWithRelations } from "../../domain/budgets/budgets.types";
import { formatTimestamp } from "@/lib/utils/timestamp";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { requireBudgetOwnership } from "@/lib/utils/security";
import { logger } from "@/lib/utils/logger";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";
import { AppError } from "../shared/app-error";
import { getCurrentUserId } from "../shared/feature-guard";
import { makeMembersService } from "../members/members.factory";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export class BudgetsService {
  constructor(
    private repository: IBudgetsRepository,
    private categoriesRepository: ICategoriesRepository,
    private transactionsRepository: ITransactionsRepository
  ) {}

  /**
   * Get budgets for a period
   */
  async getBudgets(
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetWithRelations[]> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    // Get user's household ID for filtering
    const membersService = makeMembersService();
    const householdId = await membersService.getActiveHouseholdId(userId);

    // SIMPLIFIED: Removed automatic recurring budget creation
    // Users now create budgets manually with full control
    // The isRecurring field is still stored but not used for automatic creation
    const rows = await this.repository.findAllByPeriod(period, accessToken, refreshToken);

    // Filter budgets by household or user (household budgets are shared, user budgets are personal)
    const filteredRows = rows.filter((row) => {
      // Include if it belongs to the user's household
      if (householdId && row.household_id === householdId) {
        return true;
      }
      // Include if it belongs directly to the user
      // When user has household: include budgets with matching household_id OR personal budgets (household_id is null)
      // When user has no household: include all user budgets
      if (row.user_id === userId) {
        if (householdId) {
          // User has household: include household budgets OR personal budgets
          return row.household_id === householdId || row.household_id === null;
        } else {
          // User has no household: include all user budgets
          return true;
        }
      }
      return false;
    });

    // Early return if no budgets
    if (filteredRows.length === 0) {
      return [];
    }

    // Fetch related data
    const categoryIds = [...new Set(filteredRows.map(b => b.category_id).filter(Boolean) as string[])];
    const subcategoryIds = [...new Set(filteredRows.map(b => b.subcategory_id).filter(Boolean) as string[])];

    // OPTIMIZATION: Fetch categories/subcategories first (needed for mapping)
    // Then fetch transactions in parallel with mapping operations
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    const periodEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59);

    // Fetch categories and subcategories (groups have been removed)
    const [categories, subcategories] = await Promise.all([
      categoryIds.length > 0 
        ? this.categoriesRepository.findCategoriesByIds(categoryIds, accessToken, refreshToken)
        : Promise.resolve([]),
      subcategoryIds.length > 0
        ? this.categoriesRepository.findSubcategoriesByIds(subcategoryIds, accessToken, refreshToken)
        : Promise.resolve([]),
    ]);

    // Create maps early for transaction processing
    const categoriesMap = new Map();
    categories.forEach((cat) => {
      categoriesMap.set(cat.id, cat);
    });

    const subcategoriesMap = new Map();
    subcategories.forEach((sub) => {
      subcategoriesMap.set(sub.id, sub);
    });

    // NOTE: Groups have been removed - no longer needed

    // OPTIMIZATION: Try to use materialized view first (much faster)
    // Fall back to runtime calculation if view is not available or fails
    let categorySpendMap = new Map<string, number>();
    let subcategorySpendMap = new Map<string, number>();
      // NOTE: Group spending removed - groups are no longer part of the system

    try {
      // Try to get spending from materialized view
      const spendingMap = await this.repository.getBudgetSpendingByPeriod(period, userId, accessToken, refreshToken);
      
      if (spendingMap.size > 0) {
        // Use data from materialized view
        spendingMap.forEach((spending, key) => {
          if (key.startsWith('category:')) {
            const categoryId = key.replace('category:', '');
            categorySpendMap.set(categoryId, spending.actualSpend);
          } else if (key.startsWith('subcategory:')) {
            const subcategoryId = key.replace('subcategory:', '');
            subcategorySpendMap.set(subcategoryId, spending.actualSpend);
          }
          // NOTE: Group spending removed - groups are no longer part of the system
        });
        logger.debug(`[BudgetsService] Using materialized view for budget spending calculations`);
      } else {
        // Materialized view is empty or not populated yet, fall back to runtime calculation
        throw new Error("Materialized view empty, falling back to runtime calculation");
      }
    } catch (error) {
      // Fall back to runtime calculation
      logger.debug(`[BudgetsService] Falling back to runtime calculation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      const startDateStr = periodStart.toISOString().split('T')[0];
      const endDateStr = periodEnd.toISOString().split('T')[0];
      
      // Quick check if there are any expense transactions in the period
      const supabaseCheck = await createServerClient(accessToken, refreshToken);
      const { count, error: countError } = await supabaseCheck
        .from("transactions")
        .select("*", { count: 'exact', head: true })
        .eq("type", "expense")
        .not("categoryId", "is", null)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      // If no transactions or error, skip fetching full transaction data
      let transactions: Array<{ categoryId: string; subcategoryId: string | null; amount: number }> = [];
      if (!countError && count && count > 0) {
        // Only fetch full transaction data if there are transactions
        transactions = await this.fetchTransactionsForBudgets(periodStart, periodEnd, accessToken, refreshToken);
      }

      // OPTIMIZATION: Pre-calculate spend maps instead of filtering for each budget
      // This reduces complexity from O(n*m) to O(n+m) where n=transactions, m=budgets
      categorySpendMap = new Map<string, number>();
      subcategorySpendMap = new Map<string, number>();
      // NOTE: Group spending removed

      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          // OPTIMIZATION: Amounts are always numbers now, no need for complex decryption
          const amount = typeof tx.amount === 'number' ? tx.amount : (getTransactionAmount(tx.amount) || 0);
          const absAmount = Math.abs(amount);

          // Add to category spend
          if (tx.categoryId) {
            const currentCategoryTotal = categorySpendMap.get(tx.categoryId) || 0;
            categorySpendMap.set(tx.categoryId, currentCategoryTotal + absAmount);

            // NOTE: Group spending calculation removed - groups are no longer part of the system
          }

          // Add to subcategory spend
          if (tx.subcategoryId) {
            const currentSubcategoryTotal = subcategorySpendMap.get(tx.subcategoryId) || 0;
            subcategorySpendMap.set(tx.subcategoryId, currentSubcategoryTotal + absAmount);
          }
        }
      }
    }

    // Calculate actual spend per budget using pre-calculated maps
    const budgets: BudgetWithRelations[] = filteredRows.map(row => {
      const category = row.category_id ? categoriesMap.get(row.category_id) : null;
      const subcategory = row.subcategory_id ? subcategoriesMap.get(row.subcategory_id) : null;

      // Calculate actual spend using pre-calculated maps
      let actualSpend = 0;
      if (row.subcategory_id) {
        // Subcategory budget - use subcategory spend map
        actualSpend = subcategorySpendMap.get(row.subcategory_id) || 0;
      } else if (row.category_id) {
        // Category budget - use category spend map
        actualSpend = categorySpendMap.get(row.category_id) || 0;
      }

      // SIMPLIFIED: Status and percentage calculation moved to frontend
      // Backend returns only amount and actualSpend for flexibility
      return BudgetsMapper.toDomainWithRelations(row, {
        category: category || null,
        subcategory: subcategory || null,
        actualSpend,
        // percentage and status removed - calculated in frontend using calculateBudgetStatus()
      });
    });

    return budgets;
  }

  /**
   * Fetch transactions optimized for budget calculations
   * Only selects necessary fields and filters by categoryId IS NOT NULL at DB level
   * OPTIMIZATION: Uses minimal fields to reduce data transfer
   */
  private async fetchTransactionsForBudgets(
    periodStart: Date,
    periodEnd: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<Array<{ categoryId: string; subcategoryId: string | null; amount: number }>> {
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const startDateStr = periodStart.toISOString().split('T')[0];
    const endDateStr = periodEnd.toISOString().split('T')[0];

    // OPTIMIZATION: Only select necessary fields, filter at DB level, and order by date ascending for better index usage
    const { data: transactionRows, error } = await supabase
      .from("transactions")
      .select("category_id, subcategory_id, amount")
      .eq("type", "expense")
      .not("category_id", "is", null)
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .order("date", { ascending: true }); // Use index-friendly ordering

    if (error) {
      logger.warn("[BudgetsService] Error fetching transactions for budgets:", error);
      return [];
    }

    if (!transactionRows || transactionRows.length === 0) {
      return [];
    }

    // Map to simplified format (amounts are always numbers now)
    return transactionRows.map(tx => ({
      categoryId: tx.category_id as string,
      subcategoryId: (tx.subcategory_id as string | null) || null,
      amount: typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0,
    }));
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

    // Fetch relations using repository
    const [category, subcategory] = await Promise.all([
      row.category_id ? this.categoriesRepository.findCategoryById(row.category_id, accessToken, refreshToken) : Promise.resolve(null),
      row.subcategory_id ? this.categoriesRepository.findSubcategoryById(row.subcategory_id, accessToken, refreshToken) : Promise.resolve(null),
    ]);

    return BudgetsMapper.toDomainWithRelations(row, {
      category: category ? { id: category.id, name: category.name, type: category.type || undefined } : null,
      subcategory: subcategory ? { id: subcategory.id, name: subcategory.name } : null,
    });
  }

  /**
   * Create a new budget
   */
  async createBudget(data: BudgetFormData): Promise<BaseBudget> {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    // Format period
    const periodDate = data.period instanceof Date ? data.period : new Date(data.period);
    const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    const periodStr = formatTimestamp(periodStart);

    // Get household ID for the user
    const membersService = makeMembersService();
    const householdId = await membersService.getActiveHouseholdId(userId);

    // Check if budget already exists
    const exists = await this.repository.existsForPeriod(
      periodStr,
      data.categoryId || null,
      data.subcategoryId || null,
      userId,
      householdId
    );

    if (exists) {
      throw new AppError("Budget already exists for this period and category", 409);
    }

    const id = crypto.randomUUID();
    const now = formatTimestamp(new Date());

    try {
      const budgetRow = await this.repository.create({
        id,
        period: periodStr,
        amount: data.amount,
        categoryId: data.categoryId || null,
        subcategoryId: data.subcategoryId || null,
        userId,
        householdId,
        note: null,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      });
      return BudgetsMapper.toDomain(budgetRow);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "23505") {
        throw new AppError("Budget already exists for this period and category", 409);
      }
      throw err;
    }
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


    return BudgetsMapper.toDomain(budgetRow);
  }

  /**
   * Delete a budget
   */
  async deleteBudget(id: string): Promise<void> {
    // Verify ownership
    await requireBudgetOwnership(id);

    await this.repository.delete(id);

  }

  /**
   * REMOVED: Automatic recurring budget creation
   * 
   * This method was removed as part of simplification.
   * Users now create budgets manually with full control.
   * 
   * The isRecurring field is still stored in the database and can be used
   * for UI purposes (e.g., showing "Recurring" badge) or future functionality
   * like "Copy to next month" button.
   * 
   * If needed in the future, this logic can be moved to a separate endpoint
   * like POST /api/v2/budgets/copy that allows users to explicitly copy
   * budgets to the next period.
   */
  // private async ensureRecurringBudgetsForPeriod(...) { ... }
}

