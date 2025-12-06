import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccessReadOnly } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { makePortfolioService } from "@/src/application/portfolio/portfolio.factory";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { logger } from "@/src/infrastructure/utils/logger";


export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments (read-only - allows cancelled subscriptions)
    const featureGuard = await guardFeatureAccessReadOnly(userId, "hasInvestments");
    if (!featureGuard.allowed) {
      return NextResponse.json(
        { 
          error: featureGuard.error?.message || "Investments are not available in your current plan",
          code: featureGuard.error?.code,
          planError: featureGuard.error,
        },
        { status: 403 }
      );
    }

    // Get session tokens using AuthService
    const { makeAuthService } = await import("@/src/application/auth/auth.factory");
    const authService = makeAuthService();
    const { accessToken, refreshToken } = await authService.getSessionTokens();

    // Get days parameter from query string
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 365;

    const service = makePortfolioService();
    
    // Get all portfolio data in parallel
    const [summary, holdings, accounts, historical] = await Promise.all([
      service.getPortfolioSummaryInternal(accessToken, refreshToken),
      service.getPortfolioHoldings(accessToken, refreshToken),
      service.getPortfolioAccounts(accessToken, refreshToken),
      service.getPortfolioHistoricalData(days, userId),
    ]);

    return NextResponse.json({
      summary,
      holdings,
      accounts,
      historical,
    });
  } catch (error) {
    logger.error("Error fetching portfolio data:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch portfolio data" },
      { status: 500 }
    );
  }
}

