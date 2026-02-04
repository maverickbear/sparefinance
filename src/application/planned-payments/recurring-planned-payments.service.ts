/**
 * Service to generate Planned Payments from Recurring Transactions
 * Automatically creates planned payments for recurring transactions
 */

import { makePlannedPaymentsService } from "./planned-payments.factory";
// Use new domain types (with backward compatibility)
import { PlannedPaymentFormData, PLANNED_HORIZON_DAYS } from "../../domain/financial-events/financial-events.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getTransactionAmount, decryptDescription } from "@/lib/utils/transaction-encryption";
import { getCurrentUserId } from "../shared/feature-guard";

export class RecurringPlannedPaymentsService {
  /**
   * Generate planned payments for all recurring transactions
   * Creates scheduled payments for the next PLANNED_HORIZON_DAYS
   */
  async generatePlannedPaymentsForRecurringTransactions(
    accessToken?: string,
    refreshToken?: string
  ): Promise<{ created: number; errors: number }> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { created: 0, errors: 0 };
    }

    const supabase = await createServerClient(accessToken, refreshToken);

    // Get all recurring transactions
    const { data: recurringTransactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        account:accounts(*),
        category:categories!transactions_categoryid_fkey(*),
        subcategory:subcategories!transactions_subcategoryid_fkey(id, name, logo)
      `)
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .order("date", { ascending: true });

    if (error) {
      logger.error(
        "[RecurringPlannedPaymentsService] Error fetching recurring transactions:",
        error
      );
      return { created: 0, errors: 0 };
    }

    if (!recurringTransactions || recurringTransactions.length === 0) {
      return { created: 0, errors: 0 };
    }

    const plannedPaymentsService = makePlannedPaymentsService();

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
    horizonDate.setHours(23, 59, 59, 999);

    // Get existing planned payments
    const existingPayments = await plannedPaymentsService.getPlannedPayments({
      source: "recurring",
      status: "scheduled",
      startDate: today,
      endDate: horizonDate,
    });

    const existingKeys = new Set(
      existingPayments.plannedPayments.map((pp) => {
        const date = pp.date instanceof Date ? pp.date : new Date(pp.date);
        return `${pp.accountId}-${date.toISOString().split("T")[0]}-${pp.amount}`;
      })
    );

    let created = 0;
    let errors = 0;

    // Generate planned payments for each recurring transaction
    for (const tx of recurringTransactions as any[]) {
      const originalDate = new Date(tx.date);
      const originalDay = originalDate.getDate();
      const amount = getTransactionAmount(tx.amount) ?? 0;

      if (amount === 0) {
        continue;
      }

      // Calculate next occurrence dates
      let currentDate = new Date(today);
      currentDate.setDate(originalDay);
      currentDate.setHours(0, 0, 0, 0);

      // If the day has passed this month, move to next month
      if (currentDate < today) {
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Supabase returns snake_case; resolve account id from column or joined relation
      const accountRelation = (tx as { account?: { id?: string } | Array<{ id?: string }> }).account;
      const txAccountId =
        (tx as { account_id?: string }).account_id ??
        (Array.isArray(accountRelation) ? accountRelation[0]?.id : accountRelation?.id);
      if (!txAccountId) {
        logger.warn(`[RecurringPlannedPaymentsService] Skipping recurring transaction ${tx.id}: no account_id`);
        continue;
      }

      // Generate payments until horizon
      while (currentDate <= horizonDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const key = `${txAccountId}-${dateStr}-${amount}`;

        // Skip if already exists
        if (existingKeys.has(key)) {
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
          continue;
        }

        try {
          // Handle category (Supabase returns snake_case)
          let category = null;
          if (tx.category) {
            category = Array.isArray(tx.category) ? (tx.category.length > 0 ? tx.category[0] : null) : tx.category;
          }

          // Handle subcategory
          let subcategory = null;
          if (tx.subcategory) {
            subcategory = Array.isArray(tx.subcategory) ? (tx.subcategory.length > 0 ? tx.subcategory[0] : null) : tx.subcategory;
          }

          const description = decryptDescription(tx.description) || `Recurring: ${tx.description || "Transaction"}`;
          const toAccountId = tx.type === "transfer" ? (tx.transfer_to_id ?? null) : null;

          const plannedPaymentData: PlannedPaymentFormData = {
            date: currentDate,
            type: tx.type,
            amount: Math.abs(amount),
            accountId: txAccountId,
            toAccountId: toAccountId ?? undefined,
            categoryId: category?.id || null,
            subcategoryId: subcategory?.id || null,
            description,
            source: "recurring",
          };

          await plannedPaymentsService.createPlannedPayment(plannedPaymentData);
          created++;
          existingKeys.add(key); // Add to set to avoid duplicates in same batch
        } catch (error) {
          errors++;
          logger.error(
            `[RecurringPlannedPaymentsService] Error creating planned payment for transaction ${tx.id}:`,
            error
          );
        }

        // Move to next month
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);

        // Handle edge case: if day doesn't exist in next month (e.g., Jan 31 -> Feb)
        if (currentDate.getDate() !== originalDay) {
          // Set to last day of month
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          currentDate.setHours(0, 0, 0, 0);
        }
      }
    }

    logger.info(
      `[RecurringPlannedPaymentsService] Created ${created} planned payments from recurring transactions, ${errors} errors`
    );

    return { created, errors };
  }
}

