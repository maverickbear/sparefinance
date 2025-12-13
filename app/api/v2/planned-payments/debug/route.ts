import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

/**
 * Debug endpoint to check planned payments in database
 * This helps diagnose why planned payments are not showing
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Get all planned payments for user (no filters)
    const { data: allPayments, error: allError } = await supabase
      .from("core.plannedPayments")
      .select("*")
      .eq("userId", userId)
      .order("date", { ascending: true });

    if (allError) {
      logger.error("[PlannedPaymentsDebug] Error fetching all payments:", allError);
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    // Get scheduled payments
    const { data: scheduledPayments, error: scheduledError } = await supabase
      .from("core.plannedPayments")
      .select("*")
      .eq("userId", userId)
      .eq("status", "scheduled")
      .order("date", { ascending: true });

    if (scheduledError) {
      logger.error("[PlannedPaymentsDebug] Error fetching scheduled payments:", scheduledError);
    }

    // Get payments in date range (today to 90 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + 90);
    horizonDate.setHours(23, 59, 59, 999);

    const todayStr = today.toISOString().split('T')[0];
    const horizonStr = horizonDate.toISOString().split('T')[0];

    const { data: dateRangePayments, error: dateRangeError } = await supabase
      .from("core.plannedPayments")
      .select("*")
      .eq("userId", userId)
      .eq("status", "scheduled")
      .gte("date", todayStr)
      .lte("date", horizonStr)
      .order("date", { ascending: true });

    if (dateRangeError) {
      logger.error("[PlannedPaymentsDebug] Error fetching date range payments:", dateRangeError);
    }

    // Group by type
    const byType = {
      expense: allPayments?.filter(p => p.type === "expense") || [],
      income: allPayments?.filter(p => p.type === "income") || [],
      transfer: allPayments?.filter(p => p.type === "transfer") || [],
    };

    // Group by source
    const bySource = {
      recurring: allPayments?.filter(p => p.source === "recurring") || [],
      debt: allPayments?.filter(p => p.source === "debt") || [],
      manual: allPayments?.filter(p => p.source === "manual") || [],
      subscription: allPayments?.filter(p => p.source === "subscription") || [],
    };

    // Group by status
    const byStatus = {
      scheduled: allPayments?.filter(p => p.status === "scheduled") || [],
      paid: allPayments?.filter(p => p.status === "paid") || [],
      skipped: allPayments?.filter(p => p.status === "skipped") || [],
      cancelled: allPayments?.filter(p => p.status === "cancelled") || [],
    };

    return NextResponse.json({
      summary: {
        total: allPayments?.length || 0,
        scheduled: scheduledPayments?.length || 0,
        inDateRange: dateRangePayments?.length || 0,
        dateRange: {
          start: todayStr,
          end: horizonStr,
        },
      },
      byType: {
        expense: byType.expense.length,
        income: byType.income.length,
        transfer: byType.transfer.length,
      },
      bySource: {
        recurring: bySource.recurring.length,
        debt: bySource.debt.length,
        manual: bySource.manual.length,
        subscription: bySource.subscription.length,
      },
      byStatus: {
        scheduled: byStatus.scheduled.length,
        paid: byStatus.paid.length,
        skipped: byStatus.skipped.length,
        cancelled: byStatus.cancelled.length,
      },
      samplePayments: {
        all: allPayments?.slice(0, 5).map(p => ({
          id: p.id,
          date: p.date,
          type: p.type,
          status: p.status,
          source: p.source,
          amount: p.amount,
        })) || [],
        scheduled: scheduledPayments?.slice(0, 5).map(p => ({
          id: p.id,
          date: p.date,
          type: p.type,
          status: p.status,
          source: p.source,
          amount: p.amount,
        })) || [],
        inDateRange: dateRangePayments?.slice(0, 5).map(p => ({
          id: p.id,
          date: p.date,
          type: p.type,
          status: p.status,
          source: p.source,
          amount: p.amount,
        })) || [],
      },
    });
  } catch (error) {
    logger.error("[PlannedPaymentsDebug] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

