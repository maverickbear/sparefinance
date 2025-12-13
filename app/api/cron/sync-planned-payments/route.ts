import { NextRequest, NextResponse } from "next/server";
import { DebtPlannedPaymentsService } from "@/src/application/planned-payments/debt-planned-payments.service";
import { GoalPlannedPaymentsService } from "@/src/application/planned-payments/goal-planned-payments.service";
import { RecurringPlannedPaymentsService } from "@/src/application/planned-payments/recurring-planned-payments.service";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { logger } from "@/src/infrastructure/utils/logger";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

/**
 * Cron job endpoint to sync all planned payments
 * Runs daily to ensure all planned payments are up to date
 * 
 * Security: Requires Vercel Cron header or CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Check for cron authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const vercelCron = request.headers.get('x-vercel-cron');
    
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isVercelCron = !!vercelCron;
    
    if (!isCronAuth && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info("[CronSyncPlannedPayments] Starting planned payments sync");

    const debtPlannedPaymentsService = new DebtPlannedPaymentsService();
    const goalPlannedPaymentsService = new GoalPlannedPaymentsService();
    const recurringPlannedPaymentsService = new RecurringPlannedPaymentsService();
    const debtsService = makeDebtsService();
    const goalsService = makeGoalsService();

    // Use service role client to access all users' data
    const supabase = createServiceRoleClient();

    // Get all active users (users with accounts)
    const { data: users, error: usersError } = await supabase
      .from("core.accounts")
      .select("userId")
      .not("userId", "is", null);

    if (usersError) {
      logger.error("[CronSyncPlannedPayments] Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    const uniqueUserIds = [...new Set((users || []).map((u: any) => u.userId))];
    
    logger.info(`[CronSyncPlannedPayments] Processing ${uniqueUserIds.length} users`);

    const results = {
      users: uniqueUserIds.length,
      debts: { created: 0, removed: 0, errors: 0 },
      goals: { created: 0, removed: 0, errors: 0 },
      recurring: { created: 0, errors: 0 },
    };

    // Get all debts and goals directly from database
    const { data: allDebts, error: debtsError } = await supabase
      .from("core.debts")
      .select("*")
      .eq("isPaidOff", false)
      .eq("isPaused", false);

    if (debtsError) {
      logger.error("[CronSyncPlannedPayments] Error fetching debts:", debtsError);
    } else if (allDebts) {
      for (const debtRow of allDebts) {
        try {
          // Convert to DebtWithCalculations format
          const debtForCalculation = {
            id: debtRow.id,
            name: debtRow.name,
            initialAmount: debtRow.initialAmount,
            downPayment: debtRow.downPayment,
            currentBalance: debtRow.currentBalance,
            interestRate: debtRow.interestRate,
            totalMonths: debtRow.totalMonths,
            firstPaymentDate: debtRow.firstPaymentDate,
            monthlyPayment: debtRow.monthlyPayment,
            paymentFrequency: debtRow.paymentFrequency,
            paymentAmount: debtRow.paymentAmount,
            principalPaid: debtRow.principalPaid,
            interestPaid: debtRow.interestPaid,
            additionalContributions: debtRow.additionalContributions,
            additionalContributionAmount: debtRow.additionalContributionAmount,
            priority: debtRow.priority,
            isPaused: debtRow.isPaused,
            isPaidOff: debtRow.isPaidOff,
            accountId: debtRow.accountId,
          } as any;

          const result = await debtPlannedPaymentsService.syncPlannedPaymentsForDebt(debtForCalculation);
          results.debts.created += result.created;
          results.debts.removed += result.removed;
          results.debts.errors += result.errors;
        } catch (error) {
          logger.error(`[CronSyncPlannedPayments] Error syncing debt ${debtRow.id}:`, error);
          results.debts.errors++;
        }
      }
    }

    // Get all goals with incomePercentage > 0
    const { data: allGoals, error: goalsError } = await supabase
      .from("core.goals")
      .select("*")
      .gt("incomePercentage", 0)
      .eq("isCompleted", false)
      .eq("isPaused", false)
      .not("accountId", "is", null);

    if (goalsError) {
      logger.error("[CronSyncPlannedPayments] Error fetching goals:", goalsError);
    } else if (allGoals) {
      for (const goalRow of allGoals) {
        try {
          // Calculate income basis (simplified - use expectedIncome or default)
          const incomeBasis = goalRow.expectedIncome || 5000; // Default fallback
          
          const goalForCalculation = {
            id: goalRow.id,
            name: goalRow.name,
            targetAmount: goalRow.targetAmount,
            currentBalance: goalRow.currentBalance,
            incomePercentage: goalRow.incomePercentage,
            priority: goalRow.priority,
            isPaused: goalRow.isPaused,
            isCompleted: goalRow.isCompleted,
            expectedIncome: goalRow.expectedIncome,
            targetMonths: goalRow.targetMonths,
            accountId: goalRow.accountId,
          } as any;

          const result = await goalPlannedPaymentsService.syncPlannedPaymentsForGoal(
            goalForCalculation,
            incomeBasis
          );
          results.goals.created += result.created;
          results.goals.removed += result.removed;
          results.goals.errors += result.errors;
        } catch (error) {
          logger.error(`[CronSyncPlannedPayments] Error syncing goal ${goalRow.id}:`, error);
          results.goals.errors++;
        }
      }
    }

    // Note: Recurring transactions sync requires user context
    // They should be synced when user accesses the page via the sync endpoint

    const total = {
      created: results.debts.created + results.goals.created + results.recurring.created,
      removed: results.debts.removed + results.goals.removed,
      errors: results.debts.errors + results.goals.errors + results.recurring.errors,
    };

    logger.info("[CronSyncPlannedPayments] Sync completed:", total);

    return NextResponse.json({
      success: true,
      results,
      total,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[CronSyncPlannedPayments] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

