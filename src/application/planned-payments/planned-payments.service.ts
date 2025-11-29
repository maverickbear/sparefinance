/**
 * Planned Payments Service
 * Business logic for planned payments management
 */

import { PlannedPaymentsRepository } from "@/src/infrastructure/database/repositories/planned-payments.repository";
import { PlannedPaymentsMapper } from "./planned-payments.mapper";
import { PlannedPaymentFormData } from "../../domain/planned-payments/planned-payments.validations";
import { BasePlannedPayment } from "../../domain/planned-payments/planned-payments.types";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { formatTimestamp, formatDateOnly } from "@/src/infrastructure/utils/timestamp";
import { encryptDescription } from "@/src/infrastructure/utils/transaction-encryption";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { logger } from "@/src/infrastructure/utils/logger";

export class PlannedPaymentsService {
  constructor(private repository: PlannedPaymentsRepository) {}

  /**
   * Get planned payments with optional filters
   */
  async getPlannedPayments(
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: "scheduled" | "paid" | "skipped" | "cancelled";
      source?: "recurring" | "debt" | "manual" | "subscription";
      debtId?: string;
      subscriptionId?: string;
      accountId?: string;
      type?: "expense" | "income" | "transfer";
      limit?: number;
      page?: number;
    },
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ plannedPayments: BasePlannedPayment[]; total: number }> {
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { plannedPayments: [], total: 0 };
    }

    const { data, count } = await this.repository.findAll(user.id, filters, accessToken, refreshToken);

    if (!data || data.length === 0) {
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

    const [accountsResult, categoriesResult, subcategoriesResult] = await Promise.all([
      accountIds.size > 0
        ? supabase.from("Account").select("id, name").in("id", Array.from(accountIds))
        : Promise.resolve({ data: [], error: null }),
      categoryIds.size > 0
        ? supabase.from("Category").select("id, name").in("id", Array.from(categoryIds))
        : Promise.resolve({ data: [], error: null }),
      subcategoryIds.size > 0
        ? supabase.from("Subcategory").select("id, name, logo").in("id", Array.from(subcategoryIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    const accountMap = new Map((accountsResult.data || []).map(a => [a.id, a]));
    const categoryMap = new Map((categoriesResult.data || []).map(c => [c.id, c]));
    const subcategoryMap = new Map((subcategoriesResult.data || []).map(s => [s.id, s]));

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
    const supabase = await createServerClient(accessToken, refreshToken);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const householdId = await getActiveHouseholdId(user.id);
    if (!householdId) {
      throw new Error("No active household found. Please contact support.");
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
      userId: user.id,
      householdId,
    });

    // Fetch related data for enrichment
    const relations = await this.fetchRelations(plannedPaymentRow, supabase);

    return PlannedPaymentsMapper.toDomain(plannedPaymentRow, relations);
  }

  /**
   * Update a planned payment
   */
  async updatePlannedPayment(
    id: string,
    data: Partial<PlannedPaymentFormData>
  ): Promise<BasePlannedPayment> {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
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
    const relations = await this.fetchRelations(updatedRow, supabase);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Mark planned payment as paid
   */
  async markAsPaid(id: string): Promise<BasePlannedPayment> {
    const supabase = await createServerClient();

    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new Error("Planned payment not found");
    }

    if (plannedPayment.status !== "scheduled") {
      throw new Error("Only scheduled payments can be marked as paid");
    }

    // Create transaction from planned payment
    // Note: This is a temporary import until Transactions is fully migrated
    const { createTransaction } = await import("@/lib/api/transactions");

    const description = plannedPayment.description ? 
      (await import("@/lib/utils/transaction-encryption")).decryptDescription(plannedPayment.description) : null;

    const transactionData = {
      date: new Date(plannedPayment.date),
      type: plannedPayment.type,
      amount: plannedPayment.amount,
      accountId: plannedPayment.accountId,
      toAccountId: plannedPayment.type === "transfer" ? (plannedPayment.toAccountId || undefined) : undefined,
      categoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.categoryId || undefined),
      subcategoryId: plannedPayment.type === "transfer" ? undefined : (plannedPayment.subcategoryId || undefined),
      description: description || undefined,
      recurring: false,
    };

    const transaction = await createTransaction(transactionData);

    // Update planned payment
    const updatedRow = await this.repository.update(id, {
      status: "paid",
      linkedTransactionId: transaction.id,
    });

    const relations = await this.fetchRelations(updatedRow, supabase);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Skip a planned payment
   */
  async skipPlannedPayment(id: string): Promise<BasePlannedPayment> {
    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new Error("Planned payment not found");
    }

    if (plannedPayment.status !== "scheduled") {
      throw new Error("Only scheduled payments can be skipped");
    }

    const supabase = await createServerClient();
    const updatedRow = await this.repository.update(id, {
      status: "skipped",
    });

    const relations = await this.fetchRelations(updatedRow, supabase);

    return PlannedPaymentsMapper.toDomain(updatedRow, relations);
  }

  /**
   * Cancel a planned payment
   */
  async cancelPlannedPayment(id: string): Promise<BasePlannedPayment> {
    const plannedPayment = await this.repository.findById(id);
    if (!plannedPayment) {
      throw new Error("Planned payment not found");
    }

    if (plannedPayment.status === "paid") {
      throw new Error("Paid payments cannot be cancelled");
    }

    const supabase = await createServerClient();
    const updatedRow = await this.repository.update(id, {
      status: "cancelled",
    });

    const relations = await this.fetchRelations(updatedRow, supabase);

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
    supabase: any
  ): Promise<{
    account?: { id: string; name: string } | null;
    toAccount?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string; logo?: string | null } | null;
  }> {
    const relations: any = {};

    if (row.accountId) {
      const { data: account } = await supabase
        .from("Account")
        .select("id, name")
        .eq("id", row.accountId)
        .single();
      relations.account = account || null;
    }

    if (row.toAccountId) {
      const { data: toAccount } = await supabase
        .from("Account")
        .select("id, name")
        .eq("id", row.toAccountId)
        .single();
      relations.toAccount = toAccount || null;
    }

    if (row.categoryId) {
      const { data: category } = await supabase
        .from("Category")
        .select("id, name")
        .eq("id", row.categoryId)
        .single();
      relations.category = category || null;
    }

    if (row.subcategoryId) {
      const { data: subcategory } = await supabase
        .from("Subcategory")
        .select("id, name, logo")
        .eq("id", row.subcategoryId)
        .single();
      relations.subcategory = subcategory || null;
    }

    return relations;
  }
}

