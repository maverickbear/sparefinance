/**
 * Service to generate Planned Payments from Goals
 * Automatically creates planned payments for goal deposits (income transfers to goals)
 */

import { makePlannedPaymentsService } from "./planned-payments.factory";
import { PlannedPaymentFormData } from "../../domain/planned-payments/planned-payments.validations";
import { PLANNED_HORIZON_DAYS } from "../../domain/planned-payments/planned-payments.types";
import { logger } from "@/src/infrastructure/utils/logger";
import { calculateProgress } from "@/lib/utils/goals";
import { addMonths, startOfMonth, setDate } from "date-fns";
import type { GoalWithCalculations } from "../../domain/goals/goals.types";

export class GoalPlannedPaymentsService {
  /**
   * Generate planned payments for a goal
   * Creates monthly deposit payments (income transfers) for the next PLANNED_HORIZON_DAYS
   */
  async generatePlannedPaymentsForGoal(
    goal: GoalWithCalculations,
    incomeBasis: number
  ): Promise<{ created: number; errors: number }> {
    // Skip if goal is completed, paused, or has no account
    if (goal.isCompleted || goal.isPaused || !goal.accountId) {
      return { created: 0, errors: 0 };
    }

    // Calculate monthly contribution
    const progress = calculateProgress(goal, incomeBasis);
    const monthlyContribution = progress.monthlyContribution;

    if (monthlyContribution <= 0) {
      logger.warn(`[GoalPlannedPaymentsService] Goal ${goal.id} has no monthly contribution`);
      return { created: 0, errors: 0 };
    }

    const plannedPaymentsService = makePlannedPaymentsService();

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
    horizonDate.setHours(23, 59, 59, 999);

    // Generate monthly payment dates
    // Start from next month (assuming deposits happen at the beginning of the month)
    const firstPaymentDate = startOfMonth(addMonths(today, 1));
    const paymentDates: Date[] = [];

    let currentDate = new Date(firstPaymentDate);
    while (currentDate <= horizonDate) {
      paymentDates.push(new Date(currentDate));
      currentDate = addMonths(currentDate, 1);
    }

    if (paymentDates.length === 0) {
      return { created: 0, errors: 0 };
    }

    // Check existing planned payments for this goal
    const existingPayments = await plannedPaymentsService.getPlannedPayments({
      source: "goal",
      status: "scheduled",
      startDate: today,
      endDate: horizonDate,
    });

    const existingDates = new Set(
      existingPayments.plannedPayments
        .filter((pp) => pp.goalId === goal.id)
        .map((pp) => {
          const date = pp.date instanceof Date ? pp.date : new Date(pp.date);
          return date.toISOString().split("T")[0];
        })
    );

    // Create planned payments for dates that don't exist yet
    let created = 0;
    let errors = 0;

    for (const paymentDate of paymentDates) {
      const dateStr = paymentDate.toISOString().split("T")[0];

      // Skip if already exists
      if (existingDates.has(dateStr)) {
        continue;
      }

      try {
        // Goal deposits are income transfers to the goal account
        // We need a source account - for now, we'll use the goal account itself
        // In the future, we might want to add a sourceAccountId to goals
        const plannedPaymentData: PlannedPaymentFormData = {
          date: paymentDate,
          type: "income", // Goal deposits are income to the goal account
          amount: monthlyContribution,
          accountId: goal.accountId,
          categoryId: null,
          subcategoryId: null,
          description: `Goal deposit: ${goal.name}`,
          source: "goal",
          goalId: goal.id,
        };

        await plannedPaymentsService.createPlannedPayment(plannedPaymentData);
        created++;
      } catch (error) {
        errors++;
        logger.error(
          `[GoalPlannedPaymentsService] Error creating planned payment for goal ${goal.id}:`,
          error
        );
      }
    }

    logger.info(
      `[GoalPlannedPaymentsService] Created ${created} planned payments for goal ${goal.id}, ${errors} errors`
    );

    return { created, errors };
  }

  /**
   * Sync all planned payments for a goal
   * Removes outdated payments and creates new ones
   */
  async syncPlannedPaymentsForGoal(
    goal: GoalWithCalculations,
    incomeBasis: number
  ): Promise<{ created: number; removed: number; errors: number }> {
    const plannedPaymentsService = makePlannedPaymentsService();

    // Get all existing planned payments for this goal
    const existingPayments = await plannedPaymentsService.getPlannedPayments({
      source: "goal",
      status: "scheduled",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter payments for this specific goal
    const goalPayments = existingPayments.plannedPayments.filter((pp) =>
      pp.description?.includes(goal.name)
    );

    // Remove payments if goal is completed or paused
    let removed = 0;
    if (goal.isCompleted || goal.isPaused) {
      for (const payment of goalPayments) {
        try {
          await plannedPaymentsService.cancelPlannedPayment(payment.id);
          removed++;
        } catch (error) {
          logger.error(
            `[GoalPlannedPaymentsService] Error removing planned payment ${payment.id}:`,
            error
          );
        }
      }
    } else {
      // Remove payments in the past
      for (const payment of goalPayments) {
        const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
        if (paymentDate < today) {
          try {
            await plannedPaymentsService.cancelPlannedPayment(payment.id);
            removed++;
          } catch (error) {
            logger.error(
              `[GoalPlannedPaymentsService] Error removing past planned payment ${payment.id}:`,
              error
            );
          }
        }
      }
    }

    // Generate new planned payments
    const { created, errors } = await this.generatePlannedPaymentsForGoal(goal, incomeBasis);

    return { created, removed, errors };
  }
}

