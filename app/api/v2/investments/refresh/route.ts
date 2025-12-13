/**
 * POST /api/v2/investments/refresh
 * Refresh investment data from Plaid
 */

import { NextRequest, NextResponse } from "next/server";
import { makeInvestmentsRefreshService } from "@/src/application/investments/investments.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccess } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { logger } from "@/src/infrastructure/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const featureGuard = await guardFeatureAccess(userId, "hasInvestments");
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

    // Get access tokens from Plaid items
    // Phase D: Use Plaid items access tokens instead of session tokens
    const { PlaidItemsRepository } = await import("@/src/infrastructure/database/repositories/plaid-items.repository");
    const plaidItemsRepository = new PlaidItemsRepository();
    
    // Get all Plaid items for the user
    const plaidItems = await plaidItemsRepository.findByUserId(userId);
    
    if (plaidItems.length === 0) {
      return NextResponse.json(
        { error: "No Plaid accounts connected. Please connect a bank account first." },
        { status: 404 }
      );
    }

    const refreshService = makeInvestmentsRefreshService();
    
    // Refresh investments for each Plaid item
    // For now, we'll use the first item's access token
    // In the future, we could refresh all items or let the user choose
    const firstItem = plaidItems[0];
    const accessToken = await plaidItemsRepository.getAccessToken(firstItem.item_id);
    
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to get access token. Please reconnect your account." },
        { status: 401 }
      );
    }

    const snapshot = await refreshService.refreshInvestments(userId, accessToken);

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("[Investments Refresh API] Error:", error);

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
