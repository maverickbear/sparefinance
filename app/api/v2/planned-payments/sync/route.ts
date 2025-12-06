import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { DebtPlannedPaymentsService } from "@/src/application/planned-payments/debt-planned-payments.service";
import { GoalPlannedPaymentsService } from "@/src/application/planned-payments/goal-planned-payments.service";
import { RecurringPlannedPaymentsService } from "@/src/application/planned-payments/recurring-planned-payments.service";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { logger } from "@/src/infrastructure/utils/logger";
import { AppError } from "@/src/application/shared/app-error";

/**
 * Sync all planned payments from all sources
 * This endpoint generates planned payments from:
 * - Debts
 * - Goals (with incomePercentage)
 * - Recurring Transactions
 * - Subscriptions (handled automatically when created/updated)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const debtPlannedPaymentsService = new DebtPlannedPaymentsService();
    const goalPlannedPaymentsService = new GoalPlannedPaymentsService();
    const recurringPlannedPaymentsService = new RecurringPlannedPaymentsService();
    const debtsService = makeDebtsService();
    const goalsService = makeGoalsService();

    const results = {
      debts: { created: 0, removed: 0, errors: 0 },
      goals: { created: 0, removed: 0, errors: 0 },
      recurring: { created: 0, errors: 0 },
    };

    // Sync debts
    try {
      const debts = await debtsService.getDebts();
      for (const debt of debts) {
        const result = await debtPlannedPaymentsService.syncPlannedPaymentsForDebt(debt);
        results.debts.created += result.created;
        results.debts.removed += result.removed;
        results.debts.errors += result.errors;
      }
    } catch (error) {
      logger.error("[PlannedPaymentsSync] Error syncing debts:", error);
      results.debts.errors++;
    }

    // Sync goals
    try {
      const goals = await goalsService.getGoals();
      for (const goal of goals) {
        if (goal.incomePercentage > 0 && goal.accountId) {
          const incomeBasis = await goalsService.calculateIncomeBasis(goal.expectedIncome);
          if (incomeBasis > 0) {
            const result = await goalPlannedPaymentsService.syncPlannedPaymentsForGoal(
              goal,
              incomeBasis
            );
            results.goals.created += result.created;
            results.goals.removed += result.removed;
            results.goals.errors += result.errors;
          }
        }
      }
    } catch (error) {
      logger.error("[PlannedPaymentsSync] Error syncing goals:", error);
      results.goals.errors++;
    }

    // Sync recurring transactions
    try {
      const result = await recurringPlannedPaymentsService.generatePlannedPaymentsForRecurringTransactions();
      results.recurring.created += result.created;
      results.recurring.errors += result.errors;
    } catch (error) {
      logger.error("[PlannedPaymentsSync] Error syncing recurring transactions:", error);
      results.recurring.errors++;
    }

    const total = {
      created: results.debts.created + results.goals.created + results.recurring.created,
      removed: results.debts.removed + results.goals.removed,
      errors: results.debts.errors + results.goals.errors + results.recurring.errors,
    };

    logger.info("[PlannedPaymentsSync] Sync completed:", total);

    return NextResponse.json({
      success: true,
      results,
      total,
    });
  } catch (error) {
    logger.error("[PlannedPaymentsSync] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

