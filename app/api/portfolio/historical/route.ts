import { NextResponse } from "next/server";
import { getPortfolioHistoricalData } from "@/lib/api/portfolio";
import { guardFeatureAccessReadOnly, getCurrentUserId } from "@/src/application/shared/feature-guard";

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

    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 365;

    const historicalData = await getPortfolioHistoricalData(days);
    return NextResponse.json(historicalData);
  } catch (error) {
    console.error("Error fetching portfolio historical data:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio historical data" },
      { status: 500 }
    );
  }
}

