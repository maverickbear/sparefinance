/**
 * Planned Payments Service
 * Business logic for planned payments management
 * 
 * SIMPLIFIED: Renamed to Financial Events (domain types updated)
 * This service maintains backward compatibility with old names
 */

import { PlannedPaymentsRepository } from "@/src/infrastructure/database/repositories/planned-payments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { DebtsRepository } from "@/src/infrastructure/database/repositories/debts.repository";
import { PlannedPaymentsMapper } from "./planned-payments.mapper";
// Use new domain types (with backward compatibility)
// Use new domain types (with backward compatibility)
import { 
  FinancialEventFormData, 
  BaseFinancialEvent,
  PlannedPaymentFormData, // Backward compatibility alias
  BasePlannedPayment // Backward compatibility alias
} from "../../domain/financial-events/financial-events.types";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { encryptDescription } from "@/src/infrastructure/utils/transaction-encryption";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "../shared/app-error";
import { getCurrentUserId } from "../shared/feature-guard";

export class PlannedPaymentsService {
  constructor(
    private repository: PlannedPaymentsRepository,
    private accountsRepository: AccountsRepository,
    private categoriesRepository: CategoriesRepository,
    private debtsRepository: DebtsRepository
  ) {}

  /**
   * Get planned payments with optional filters
   * @param filters - Optional filters for planned payments
   * @param accessToken - Optional access token for authentication
   * @param refreshToken - Optional refresh token for authentication
   * @param userId - Optional userId (if provided, skips getCurrentUserId() call - useful in cached functions)
   */
  async getPlannedPayments(
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
      source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
      debtId?: string;
      subscriptionId?: string;
      goalId?: string;
      accountId?: string;
      type?: "expense" | "income" | "transfer";
      limit?: number;
      page?: number;
    },
    accessToken?: string,
    refreshToken?: string,
    userId?: string
  ): Promise<{ plannedPayments: BaseFinancialEvent[]; total: number }> {
    // If userId is not provided, get it from context
    // This allows the function to be called from cached functions where cookies() is not available
    let finalUserId: string | null = userId ?? null;
    if (!finalUserId) {
      finalUserId = await getCurrentUserId();
      if (!finalUserId) {
        logger.warn("[PlannedPaymentsService] No userId found");
        return { plannedPayments: [], total: 0 };
      }
    }

    logger.info("[PlannedPaymentsService] Getting planned payments:", {
      userId: finalUserId,
      filters: {
        startDate: filters?.startDate?.toISOString(),
        endDate: filters?.endDate?.toISOString(),
        status: filters?.status,
        type: filters?.type,
        source: filters?.source,
        page: filters?.page,
        limit: filters?.limit,
      },
    });

    const { data, count } = await this.repository.findAll(finalUserId, filters, accessToken, refreshToken);

    logger.info("[PlannedPaymentsService] Repository returned:", {
      dataCount: data?.length || 0,
      totalCount: count,
    });

    if (!data || data.length === 0) {
      logger.info("[PlannedPaymentsService] No planned payments found");
      return { plannedPayments: [], total: count || 0 };
    }

    // Batch fetch related data
    const accountIds = new Set<string>();
    const categoryIds = new Set<string>();
    const subcategoryIds = new Set<string>();
    const debtIds = new Set<string>();

    data.forEach(pp => {
      if (pp.account_id) accountIds.add(pp.account_id);
      if (pp.to_account_id) accountIds.add(pp.to_account_id);
      if (pp.category_id) categoryIds.add(pp.category_id);
      if (pp.subcategory_id) subcategoryIds.add(pp.subcategory_id);
      if (pp.debt_id) debtIds.add(pp.debt_id);
    });

    const [accounts, categories, subcategories, debts] = await Promise.all([
      accountIds.size > 0
        ? this.accountsRepository.findByIds(Array.from(accountIds), accessToken, refreshToken)
        : Promise.resolve([]),
      categoryIds.size > 0
        ? this.categoriesRepository.findCategoriesByIds(Array.from(categoryIds), accessToken, refreshToken)
        : Promise.resolve([]),
      subcategoryIds.size > 0
        ? this.categoriesRepository.findSubcategoriesByIds(Array.from(subcategoryIds), accessToken, refreshToken)
        : Promise.resolve([]),
      debtIds.size > 0
        ? this.debtsRepository.findByIds(Array.from(debtIds), accessToken, refreshToken)
        : Promise.resolve([]),
    ]);

    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const subcategoryMap = new Map(subcategories.map(s => [s.id, s]));
    const debtMap = new Map(debts.map(d => [d.id, d]));

    const plannedPayments = data.map(pp => {
      return PlannedPaymentsMapper.toDomain(pp, {
        account: pp.account_id ? (accountMap.get(pp.account_id) || null) : null,
        toAccount: pp.to_account_id ? (accountMap.get(pp.to_account_id) || null) : null,
        category: pp.category_id ? (categoryMap.get(pp.category_id) || null) : null,
        subcategory: pp.subcategory_id ? (subcategoryMap.get(pp.subcategory_id) || null) : null,
        debt: pp.debt_id ? (debtMap.get(pp.debt_id) || null) : null,
      });
    });

    return {
      plannedPayments,
      total: count || 0,
    };
  }

  /**
   * Create a new planned payment
   */
  async createPlannedPayment(
    data: FinancialEventFormData,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BaseFinancialEvent> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const householdId = await getActiveHouseholdId(userId);
    if (!householdId) {
      throw new AppError("No active household found. Please contact support.", 400);
    }

    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const transactionDate = formatDateOnly(date);
    const encryptedDescription = encryptDescription(data.description || null);

    // Use mapper to convert to snake_case for repository
    const plannedPaymentData = PlannedPaymentsMapper.toRepository({
      date: transactionDate,
      type: data.type,
      amount: data.amount,
      accountId: data.accountId,
      toAccountId: data.type === "transfer" ? (data.toAccountId || null) : null,
      categoryId: data.type === "transfer" ? null : (data.categoryId || null),
      subcategoryId: data.type === "transfer" ? null : (data.subcategoryId || null),
      description: encryptedDescription,
      source: data.source || "manual",
      status: "scheduled",
      linkedTransactionId: null,
      debtId: data.debtId || null,
      subscriptionId: data.subscriptionId || null,
      goalId: data.goalId || null,
      userId,
      householdId,
    });
    
    const plannedPaymentRow = await this.repository.create(plannedPaymentData as any);

    // Fetch related data for enrichment
    const relations = await this.fetchRelations(plannedPaymentRow, accessToken, refreshToken);

    return PlannedPaymentsMapper.toDomain(plannedPaymentRow, relations);
  }

  /**
   * Update a planned payment
   */
  async updatePlannedPayment(
    id: string,
    data: Partial<FinancialEventFormData>
  ): Promise<BaseFinancialEvent> {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const updateData: any = {};

    if (data.date !== undefined) {
      const date = data.date instanceof Date ? data.date : new Date(data.date);
      updateData.date = formatDateOnly(date);
    }

    if (data.amount !== undefined) {
      updateData.amount = data.amount;
    }

    if (data.accountId !== undefined) {
      updateData.accountId = data.accountId;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
      if (data.type === "transfer") {
        updateData.toAccountId = data.toAccountId || null;
        updateData.categoryId = null;
        updateData.subcategoryId = null;
      } else {
        updateData.toAccountId = null;
        updateData.categoryId = data.categoryId || null;
        updateData.subcategoryId = data.subcategoryId || null;
      }
    } else {
      if (data.toAccountId !== undefined) {
        updateData.toAccountId = data.toAccountId;
      }
      if (data.categoryId !== undefined) {
        updateData.categoryId = data.categoryId;
      }
      if (data.subcategoryId !== undefined) {
        updateData.subcategoryId = data.subcategoryId;
      }
    }

    if (data.description !== undefined) {
      updateData.description = encryptDescription(data.description || null);
    }

    if (data.source !== undefined) {
      updateData.source = data.source;
    }

    if (data.debtId !== undefined) {
      updateData.debtId = data.debtId;
    }

    if (data.subscriptionId !== undefined) {
      updateData.subscriptionId = data.subscriptionId;
    }

    const updatedRow = await this.repository.update(id, updateData);

    // Fetch related data
    const relations = await this.fetchRelations(updatedRow);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Mark planned payment as paid
   */
  async markAsPaid(id: string): Promise<BaseFinancialEvent> {
    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new AppError("Planned payment not found", 404);
    }

    if (plannedPayment.status !== "scheduled") {
      throw new AppError("Only scheduled payments can be marked as paid", 400);
    }

    // Create transaction from planned payment
    const { makeTransactionsService } = await import("@/src/application/transactions/transactions.factory");
    const { decryptDescription } = await import("@/src/infrastructure/utils/transaction-encryption");

    const description = plannedPayment.description ? 
      decryptDescription(plannedPayment.description) : null;

    const transactionsService = makeTransactionsService();
    
    const transaction = await transactionsService.createTransaction({
      date: new Date(plannedPayment.date),
      type: plannedPayment.type,
      amount: plannedPayment.amount,
      accountId: plannedPayment.account_id,
      toAccountId: plannedPayment.type === "transfer" ? (plannedPayment.to_account_id || undefined) : undefined,
      categoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.category_id || undefined),
      subcategoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.subcategory_id || undefined),
      description: description || undefined,
      recurring: false,
    });

    // Update planned payment
    const updatedRow = await this.repository.update(id, {
      status: "paid",
      linked_transaction_id: transaction.id,
    });

    const relations = await this.fetchRelations(updatedRow);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Skip a planned payment
   */
  async skipPlannedPayment(id: string): Promise<BaseFinancialEvent> {
    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new AppError("Planned payment not found", 404);
    }

    if (plannedPayment.status !== "scheduled") {
      throw new AppError("Only scheduled payments can be skipped", 400);
    }

    const updatedRow = await this.repository.update(id, {
      status: "skipped",
    });

    const relations = await this.fetchRelations(updatedRow);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Cancel a planned payment
   */
  async cancelPlannedPayment(id: string): Promise<BaseFinancialEvent> {
    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new AppError("Planned payment not found", 404);
    }

    if (plannedPayment.status === "paid") {
      throw new AppError("Paid payments cannot be cancelled", 400);
    }

    const updatedRow = await this.repository.update(id, {
      status: "cancelled",
    });

    const relations = await this.fetchRelations(updatedRow);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Delete a planned payment
   */
  async deletePlannedPayment(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Get counts by type (expense, income, transfer) in a single query
   * This is more efficient than calling getPlannedPayments 3 times
   */
  async getCountsByType(
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ expense: number; income: number; transfer: number }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.warn("[PlannedPaymentsService] No userId found for getCountsByType");
      return { expense: 0, income: 0, transfer: 0 };
    }

    logger.info("[PlannedPaymentsService] Getting counts by type:", {
      userId,
      filters: {
        startDate: filters?.startDate?.toISOString(),
        endDate: filters?.endDate?.toISOString(),
        status: filters?.status,
      },
    });

    const counts = await this.repository.countByType(userId, filters, accessToken, refreshToken);

    logger.info("[PlannedPaymentsService] Counts by type result:", {
      userId,
      counts,
    });

    return counts;
  }

  /**
   * Helper to fetch relations for enrichment
   */
  private async fetchRelations(
    row: any,
    accessToken?: string,
    refreshToken?: string
  ): Promise<{
    account?: { id: string; name: string } | null;
    toAccount?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string; logo?: string | null } | null;
    debt?: { id: string; name: string } | null;
  }> {
    const relations: any = {};

    if (row.account_id) {
      const account = await this.accountsRepository.findById(row.account_id, accessToken, refreshToken);
      relations.account = account ? { id: account.id, name: account.name } : null;
    }

    if (row.to_account_id) {
      const toAccount = await this.accountsRepository.findById(row.to_account_id, accessToken, refreshToken);
      relations.toAccount = toAccount ? { id: toAccount.id, name: toAccount.name } : null;
    }

    if (row.category_id) {
      const category = await this.categoriesRepository.findCategoryById(row.category_id, accessToken, refreshToken);
      relations.category = category ? { id: category.id, name: category.name } : null;
    }

    if (row.subcategory_id) {
      const subcategory = await this.categoriesRepository.findSubcategoryById(row.subcategory_id, accessToken, refreshToken);
      relations.subcategory = subcategory ? { id: subcategory.id, name: subcategory.name, logo: subcategory.logo } : null;
    }

    if (row.debt_id) {
      const debt = await this.debtsRepository.findById(row.debt_id, accessToken, refreshToken);
      relations.debt = debt ? { id: debt.id, name: debt.name } : null;
    }

    return relations;
  }
}

