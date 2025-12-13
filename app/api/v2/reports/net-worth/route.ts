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
import { makePortfolioService } from "@/src/application/portfolio/portfolio.factory";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreService = new ReportsCoreService();

    // Fetch required data in parallel
    const [accounts, debtsResult, portfolioResult] = await Promise.all([
      getAccountsForDashboard(false).catch(() => []),
      makeDebtsService().getDebts().catch(() => []),
      makePortfolioService().getPortfolioSummary(userId).catch(() => null),
    ]);

    // Get session tokens for portfolio
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    try {
      const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
      const supabase = await createServerClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    } catch (error) {
      // Continue without tokens
    }

    const netWorth = await coreService.getNetWorth(
      userId,
      accounts,
      debtsResult,
      portfolioResult,
      accessToken,
      refreshToken
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
