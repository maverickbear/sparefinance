import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import { guardFeatureAccessReadOnly } from "@/lib/api/feature-guard";
import { createServerClient } from "@/lib/supabase-server";
import { 
  getPortfolioSummaryInternal, 
  getPortfolioAccountsInternal,
  getPortfolioHistoricalDataInternal,
  getPortfolioInternalData,
  convertSupabaseHoldingToHolding
} from "@/lib/api/portfolio";

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

    // Get session tokens
    const supabase = await createServerClient();
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          accessToken = session.access_token;
          refreshToken = session.refresh_token;
        }
      }
    } catch (error: any) {
      console.warn("[Portfolio All] Could not get session tokens:", error?.message);
    }

    // Get days parameter from query string
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 365;

    // OPTIMIZED: Get shared portfolio data once
    // This avoids duplicate calls to getHoldings() and getInvestmentAccounts()
    const sharedData = await getPortfolioInternalData(accessToken, refreshToken);
    
    // Create authenticated supabase client for getPortfolioAccountsInternal
    const authenticatedSupabase = await createServerClient(accessToken, refreshToken);
    
    // Calculate all portfolio data using shared data
    // This ensures we only call getHoldings() and getInvestmentAccounts() once
    const [summary, accounts, historical] = await Promise.all([
      getPortfolioSummaryInternal(accessToken, refreshToken, sharedData),
      getPortfolioAccountsInternal(sharedData, authenticatedSupabase),
      getPortfolioHistoricalDataInternal(days, accessToken, refreshToken, sharedData),
    ]);

    // Convert holdings to portfolio format
    const holdings = await Promise.all(
      sharedData.holdings.map(convertSupabaseHoldingToHolding)
    );

    return NextResponse.json({
      summary,
      holdings,
      accounts,
      historical,
    });
  } catch (error) {
    console.error("Error fetching portfolio data:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio data" },
      { status: 500 }
    );
  }
}

