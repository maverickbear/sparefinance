/**
 * Net Worth Report API endpoint
 * GET /api/v2/reports/net-worth
 * 
 * SIMPLIFIED: Core report endpoint for Net Worth
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { ReportsCoreService } from "@/src/application/reports/reports-core.service";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getAccountsForDashboard } from "@/src/application/accounts/get-dashboard-accounts";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreService = new ReportsCoreService();

    const [accounts, debtsResult] = await Promise.all([
      getAccountsForDashboard(false).catch(() => []),
      makeDebtsService().getDebts().catch(() => []),
    ]);

    const netWorth = await coreService.getNetWorth(
      userId,
      accounts,
      debtsResult,
      null,
      undefined,
      undefined
    );

    const cacheHeaders = getCacheHeaders('computed');

    return NextResponse.json(netWorth, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching net worth report:", error);

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
