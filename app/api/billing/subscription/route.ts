import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { checkTransactionLimit, checkAccountLimit } from "@/src/application/shared/feature-guard";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

/**
 * GET /api/billing/subscription
 * 
 * Returns current user's subscription data (subscription + plan + limits)
 * Uses unified subscription API as single source of truth
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use SubscriptionsService - single source of truth
    const subscriptionsService = makeSubscriptionsService();
    const { subscription, plan, limits } = await subscriptionsService.getUserSubscriptionData(userId);
    
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
        if (!includeStripe || !subscription?.stripeSubscriptionId || !plan) {
          return null;
        }
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId
          );
          const priceId = stripeSubscription.items.data[0]?.price.id;
          
          if (priceId && plan) {
            if (plan.stripePriceIdMonthly === priceId) {
              return "month";
            } else if (plan.stripePriceIdYearly === priceId) {
              return "year";
            }
          }
        } catch (error) {
          console.error("Error fetching Stripe subscription interval:", error);
        }
        return null;
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
        subscription,
        plan,
        limits,
        interval: intervalResult,
        transactionLimit: limitsResult.transactionLimit,
        accountLimit: limitsResult.accountLimit,
      },
      {
      }
    );
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

