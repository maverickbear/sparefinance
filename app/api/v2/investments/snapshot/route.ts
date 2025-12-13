/**
 * GET /api/v2/investments/snapshot
 * Get current portfolio snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { makeInvestmentsRefreshService } from "@/src/application/investments/investments.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccessReadOnly } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments (read-only)
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

    const refreshService = makeInvestmentsRefreshService();
    const snapshot = await refreshService.calculatePortfolioSnapshot(userId);

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("[Investments Snapshot API] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get portfolio snapshot" },
      { status: 500 }
    );
  }
}
