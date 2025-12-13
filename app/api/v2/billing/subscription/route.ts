import { NextRequest, NextResponse } from "next/server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { checkAccountLimit, checkTransactionLimit, getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/billing/subscription
 * 
 * Returns current user's subscription data (subscription + plan + limits)
 * Uses SubscriptionsService as single source of truth
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const subscriptionData = await getCachedSubscriptionData(userId);
    
    // OPTIMIZATION: Fetch limits in parallel with Stripe interval check
    // This reduces total request time by doing everything in parallel
    const { searchParams } = new URL(request.url);
    const includeStripe = searchParams.get("includeStripe") === "true";
    const includeLimits = searchParams.get("includeLimits") !== "false"; // Default true
    
    // Fetch everything in parallel for better performance
    const [intervalResult, limitsResult] = await Promise.all([
      // Determine subscription interval (monthly/yearly) from Stripe
      // OPTIMIZATION: Only fetch from Stripe if explicitly requested (includeStripe=true)
      (async (): Promise<"month" | "year" | null> => {
        if (!includeStripe || !subscriptionData.subscription?.stripeSubscriptionId || !subscriptionData.plan) {
          return null;
        }
        try {
          const stripeService = makeStripeService();
          return await stripeService.getSubscriptionInterval(
            subscriptionData.subscription.stripeSubscriptionId,
            subscriptionData.plan
          );
        } catch (error) {
          console.error("Error fetching Stripe subscription interval:", error);
          return null;
        }
      })(),
      // Fetch transaction and account limits (only if requested)
      includeLimits
        ? Promise.all([
            checkTransactionLimit(userId),
            checkAccountLimit(userId),
          ]).then(([transactionLimit, accountLimit]) => ({
            transactionLimit,
            accountLimit,
          }))
        : Promise.resolve({ transactionLimit: null, accountLimit: null }),
    ]);

    // Add cache headers for better performance
    // Cache for 60 seconds - subscription data doesn't change frequently
    return NextResponse.json(
      {
        subscription: subscriptionData.subscription,
        plan: subscriptionData.plan,
        limits: subscriptionData.limits,
        interval: intervalResult,
        transactionLimit: limitsResult.transactionLimit,
        accountLimit: limitsResult.accountLimit,
      },
      {
      }
    );
  } catch (error) {
    console.error("Error fetching subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

