import { NextRequest, NextResponse } from "next/server";
import { searchSecurityBySymbol, searchSecuritiesByName } from "@/lib/api/market-prices";
import { guardFeatureAccess, getCurrentUserId } from "@/src/application/shared/feature-guard";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const query = searchParams.get("query") || searchParams.get("q");

    // If query parameter is provided, search by name (returns list)
    if (query && query.trim() !== "") {
      const results = await searchSecuritiesByName(query.trim());
      return NextResponse.json({ results });
    }

    // If symbol parameter is provided, search by symbol (returns single result)
    if (symbol && symbol.trim() !== "") {
      const securityInfo = await searchSecurityBySymbol(symbol.trim());

      if (!securityInfo) {
        return NextResponse.json(
          { error: "Security not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(securityInfo);
    }

    return NextResponse.json(
      { error: "Either 'symbol' or 'query' parameter is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error searching security:", error);
    return NextResponse.json(
      { error: "Failed to search security" },
      { status: 500 }
    );
  }
}

