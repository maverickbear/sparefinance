import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccessReadOnly } from "@/src/application/shared/feature-guard";
import { createServerClient } from "../../../src/infrastructure/database/supabase-server";
import { 
  getPortfolioSummaryInternal, 
  getPortfolioAccountsInternal,
  getPortfolioHistoricalDataInternal,
  getPortfolioInternalData,
  convertSupabaseHoldingToHolding
} from "@/lib/api/portfolio";
import { logger } from "../../../src/infrastructure/utils/logger";

// In-memory cache for request deduplication
// Prevents duplicate calls within a short time window (5 seconds)
// Cache stores the data (not the Response) to avoid ReadableStream lock issues
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds (increased from 2s to catch parallel requests)

// Clean up expired cache entries periodically
function cleanPortfolioCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}

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
      logger.warn("[Portfolio All] Could not get session tokens:", error?.message);
    }

    // Get days parameter from query string
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 365;

    // OPTIMIZED: Request deduplication - reuse in-flight requests within cache TTL
    const cacheKey = `portfolio-all:${userId}:${days}`;
    const cached = requestCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Reuse in-flight request - get the data and create a new Response
      // This avoids ReadableStream lock issues when multiple requests use the same response
      const cacheAge = now - cached.timestamp;
      logger.log(`[Portfolio All] Cache hit: ${cacheKey}, age: ${cacheAge}ms`);
      const data = await cached.promise;
      return NextResponse.json(data);
    }
    
    if (cached) {
      const cacheAge = now - cached.timestamp;
      logger.log(`[Portfolio All] Cache miss: ${cacheKey}, expired by ${cacheAge - CACHE_TTL}ms`);
    }

    // Clean up expired entries (1% chance to avoid overhead)
    if (Math.random() < 0.01) {
      cleanPortfolioCache();
    }

    // Create new request promise that returns data (not Response)
    // This allows multiple requests to reuse the same data without stream lock issues
    const requestPromise = (async () => {
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

      // Return data object (not NextResponse) to allow reuse without stream lock
      return {
        summary,
        holdings,
        accounts,
        historical,
      };
    })();

    // Store in cache
    requestCache.set(cacheKey, { promise: requestPromise, timestamp: now });
    
    // Clean up after TTL expires
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, CACHE_TTL);

    // Get data and create a new Response for this request
    const data = await requestPromise;
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Error fetching portfolio data:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio data" },
      { status: 500 }
    );
  }
}

