/**
 * Planned Payments Service
 * Business logic for planned payments management
 */

import { PlannedPaymentsRepository } from "@/src/infrastructure/database/repositories/planned-payments.repository";
import { AccountsRepository } from "@/src/infrastructure/database/repositories/accounts.repository";
import { CategoriesRepository } from "@/src/infrastructure/database/repositories/categories.repository";
import { PlannedPaymentsMapper } from "./planned-payments.mapper";
import { PlannedPaymentFormData } from "../../domain/planned-payments/planned-payments.validations";
import { BasePlannedPayment } from "../../domain/planned-payments/planned-payments.types";
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
    private categoriesRepository: CategoriesRepository
  ) {}

  /**
   * Get planned payments with optional filters
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
    refreshToken?: string
  ): Promise<{ plannedPayments: BasePlannedPayment[]; total: number }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.warn("[PlannedPaymentsService] No userId found");
      return { plannedPayments: [], total: 0 };
    }

    logger.info("[PlannedPaymentsService] Getting planned payments:", {
      userId,
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

    const { data, count } = await this.repository.findAll(userId, filters, accessToken, refreshToken);

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

    data.forEach(pp => {
      if (pp.accountId) accountIds.add(pp.accountId);
      if (pp.toAccountId) accountIds.add(pp.toAccountId);
      if (pp.categoryId) categoryIds.add(pp.categoryId);
      if (pp.subcategoryId) subcategoryIds.add(pp.subcategoryId);
    });

    const [accounts, categories, subcategories] = await Promise.all([
      accountIds.size > 0
        ? this.accountsRepository.findByIds(Array.from(accountIds), accessToken, refreshToken)
        : Promise.resolve([]),
      categoryIds.size > 0
        ? this.categoriesRepository.findCategoriesByIds(Array.from(categoryIds), accessToken, refreshToken)
        : Promise.resolve([]),
      subcategoryIds.size > 0
        ? this.categoriesRepository.findSubcategoriesByIds(Array.from(subcategoryIds), accessToken, refreshToken)
        : Promise.resolve([]),
    ]);

    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const subcategoryMap = new Map(subcategories.map(s => [s.id, s]));

    const plannedPayments = data.map(pp => {
      return PlannedPaymentsMapper.toDomain(pp, {
        account: pp.accountId ? (accountMap.get(pp.accountId) || null) : null,
        toAccount: pp.toAccountId ? (accountMap.get(pp.toAccountId) || null) : null,
        category: pp.categoryId ? (categoryMap.get(pp.categoryId) || null) : null,
        subcategory: pp.subcategoryId ? (subcategoryMap.get(pp.subcategoryId) || null) : null,
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
    data: PlannedPaymentFormData,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BasePlannedPayment> {
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

    const plannedPaymentRow = await this.repository.create({
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

    // Fetch related data for enrichment
    const relations = await this.fetchRelations(plannedPaymentRow, accessToken, refreshToken);

    return PlannedPaymentsMapper.toDomain(plannedPaymentRow, relations);
  }

  /**
   * Update a planned payment
   */
  async updatePlannedPayment(
    id: string,
    data: Partial<PlannedPaymentFormData>
  ): Promise<BasePlannedPayment> {
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
  async markAsPaid(id: string): Promise<BasePlannedPayment> {
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
      accountId: plannedPayment.accountId,
      toAccountId: plannedPayment.type === "transfer" ? (plannedPayment.toAccountId || undefined) : undefined,
      categoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.categoryId || undefined),
      subcategoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.subcategoryId || undefined),
      description: description || undefined,
      recurring: false,
    });

    // Update planned payment
    const updatedRow = await this.repository.update(id, {
      status: "paid",
      linkedTransactionId: transaction.id,
    });

    const relations = await this.fetchRelations(updatedRow);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Skip a planned payment
   */
  async skipPlannedPayment(id: string): Promise<BasePlannedPayment> {
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
  async cancelPlannedPayment(id: string): Promise<BasePlannedPayment> {
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
  }> {
    const relations: any = {};

    if (row.accountId) {
      const account = await this.accountsRepository.findById(row.accountId, accessToken, refreshToken);
      relations.account = account ? { id: account.id, name: account.name } : null;
    }

    if (row.toAccountId) {
      const toAccount = await this.accountsRepository.findById(row.toAccountId, accessToken, refreshToken);
      relations.toAccount = toAccount ? { id: toAccount.id, name: toAccount.name } : null;
    }

    if (row.categoryId) {
      const category = await this.categoriesRepository.findCategoryById(row.categoryId, accessToken, refreshToken);
      relations.category = category ? { id: category.id, name: category.name } : null;
    }

    if (row.subcategoryId) {
      const subcategory = await this.categoriesRepository.findSubcategoryById(row.subcategoryId, accessToken, refreshToken);
      relations.subcategory = subcategory ? { id: subcategory.id, name: subcategory.name, logo: subcategory.logo } : null;
    }

    return relations;
  }
}

