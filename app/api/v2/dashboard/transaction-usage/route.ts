import { NextRequest, NextResponse } from "next/server";
import { makeDashboardService } from "@/src/application/dashboard/dashboard.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * GET /api/v2/dashboard/transaction-usage
 * Get current transaction usage vs limit for the current month
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Optional month parameter (defaults to current month)
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const month = monthParam ? new Date(monthParam) : undefined;

    const service = makeDashboardService();
    const usage = await service.getTransactionUsage(userId, month);

    return NextResponse.json(usage, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error("[TRANSACTION-USAGE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get transaction usage" },
      { status: 500 }
    );
  }
}

