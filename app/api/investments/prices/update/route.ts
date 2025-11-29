import { NextRequest, NextResponse } from "next/server";
import { updateAllSecurityPrices } from "@/lib/api/market-prices";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";

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

    const result = await updateAllSecurityPrices();

    return NextResponse.json({
      success: true,
      updated: result.updated,
      errors: result.errors || [],
    });
  } catch (error) {
    console.error("Error updating security prices:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to update security prices",
      },
      { status: 500 }
    );
  }
}

