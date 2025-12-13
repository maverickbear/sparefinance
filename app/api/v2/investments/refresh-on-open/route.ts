/**
 * POST /api/v2/investments/refresh-on-open
 * Refresh investments on app open (lazy refresh)
 */

import { NextRequest, NextResponse } from "next/server";
import { makeInvestmentsRefreshService } from "@/src/application/investments/investments.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccessReadOnly } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { logger } from "@/src/infrastructure/utils/logger";

export async function POST(request: NextRequest) {
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

    // Get access token (optional - refresh will work without it, just won't sync from Plaid)
    const authService = makeAuthService();
    const { accessToken } = await authService.getSessionTokens().catch(() => ({ accessToken: null }));

    const refreshService = makeInvestmentsRefreshService();
    const snapshot = await refreshService.refreshOnOpen(
      userId,
      accessToken || ""
    );

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("[Investments Refresh On Open API] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh investments" },
      { status: 500 }
    );
  }
}
