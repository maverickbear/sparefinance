import { NextRequest, NextResponse } from "next/server";
import { getHoldings } from "@/lib/api/investments";
import { guardFeatureAccess, getCurrentUserId } from "@/lib/api/feature-guard";

export async function GET(request: NextRequest) {
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

    // Get accountId from query params if provided
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;

    const holdings = await getHoldings(accountId);
    return NextResponse.json(holdings);
  } catch (error) {
    console.error("Error fetching portfolio holdings:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio holdings" },
      { status: 500 }
    );
  }
}

