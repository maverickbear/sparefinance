/**
 * Service to generate Planned Payments from Debts
 * Automatically creates planned payments for debt obligations
 */

import { makePlannedPaymentsService } from "./planned-payments.factory";
// Use new domain types (with backward compatibility)
import { PlannedPaymentFormData, PLANNED_HORIZON_DAYS } from "../../domain/financial-events/financial-events.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { calculateNextPaymentDates } from "@/lib/utils/debts";
import type { DebtWithCalculations } from "../../domain/debts/debts.types";

export class DebtPlannedPaymentsService {
  /**
   * Generate planned payments for a debt
   * Creates scheduled payments for the next PLANNED_HORIZON_DAYS
   */
  async generatePlannedPaymentsForDebt(
    debt: DebtWithCalculations
  ): Promise<{ created: number; errors: number }> {
    // Skip if debt is paid off or paused
    if (debt.isPaidOff || debt.isPaused || !debt.accountId) {
      return { created: 0, errors: 0 };
    }

    const plannedPaymentsService = makePlannedPaymentsService();

    // Calculate payment amount
    const paymentAmount = debt.paymentAmount || debt.monthlyPayment;
    if (!paymentAmount || paymentAmount <= 0) {
      logger.warn(`[DebtPlannedPaymentsService] Debt ${debt.id} has no payment amount`);
      return { created: 0, errors: 0 };
    }

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
    horizonDate.setHours(23, 59, 59, 999);

    // Get next payment dates
    const paymentDates = calculateNextPaymentDates(debt, today, horizonDate);

    if (paymentDates.length === 0) {
      return { created: 0, errors: 0 };
    }

    // Check existing planned payments for this debt
    const existingPayments = await plannedPaymentsService.getPlannedPayments({
      debtId: debt.id,
      status: "scheduled",
      startDate: today,
      endDate: horizonDate,
    });

    const existingDates = new Set(
      existingPayments.plannedPayments.map((pp) => {
        const date = pp.date instanceof Date ? pp.date : new Date(pp.date);
        return date.toISOString().split("T")[0];
      })
    );

    // Create planned payments for dates that don't exist yet
    let created = 0;
    let errors = 0;

    for (const paymentDate of paymentDates) {
      const dateStr = paymentDate.date.toISOString().split("T")[0];

      // Skip if already exists
      if (existingDates.has(dateStr)) {
        continue;
      }

      try {
        const plannedPaymentData: PlannedPaymentFormData = {
          date: paymentDate.date,
          type: "expense",
          amount: paymentDate.amount,
          accountId: debt.accountId!,
          categoryId: null,
          subcategoryId: null,
          description: `Payment: ${debt.name}`,
          source: "debt",
          debtId: debt.id,
        };

        await plannedPaymentsService.createPlannedPayment(plannedPaymentData);
        created++;
      } catch (error) {
        errors++;
        logger.error(
          `[DebtPlannedPaymentsService] Error creating planned payment for debt ${debt.id}:`,
          error
        );
      }
    }

    logger.info(
      `[DebtPlannedPaymentsService] Created ${created} planned payments for debt ${debt.id}, ${errors} errors`
    );

    return { created, errors };
  }

  /**
   * Sync all planned payments for a debt
   * Removes outdated payments and creates new ones
   */
  async syncPlannedPaymentsForDebt(
    debt: DebtWithCalculations
  ): Promise<{ created: number; removed: number; errors: number }> {
    const plannedPaymentsService = makePlannedPaymentsService();

    // Get all existing planned payments for this debt
    const existingPayments = await plannedPaymentsService.getPlannedPayments({
      debtId: debt.id,
      status: "scheduled",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Remove payments that are in the past or debt is paid off/paused
    let removed = 0;
    if (debt.isPaidOff || debt.isPaused) {
      for (const payment of existingPayments.plannedPayments) {
        try {
          await plannedPaymentsService.cancelPlannedPayment(payment.id);
          removed++;
        } catch (error) {
          logger.error(
            `[DebtPlannedPaymentsService] Error removing planned payment ${payment.id}:`,
            error
          );
        }
      }
    } else {
      // Remove payments in the past
      for (const payment of existingPayments.plannedPayments) {
        const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
        if (paymentDate < today) {
          try {
            await plannedPaymentsService.cancelPlannedPayment(payment.id);
            removed++;
          } catch (error) {
            logger.error(
              `[DebtPlannedPaymentsService] Error removing past planned payment ${payment.id}:`,
              error
            );
          }
        }
      }
    }

    // Generate new planned payments
    const { created, errors } = await this.generatePlannedPaymentsForDebt(debt);

    return { created, removed, errors };
  }
}

