import { NextResponse } from "next/server";
import { getCurrentUserSubscription, getPlanById } from "@/lib/api/plans";
import { resolvePlanFeatures } from "@/lib/utils/plan-features";
import { createServerClient } from "@/lib/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if we should skip Stripe API call (for faster preload during login)
    const { searchParams } = new URL(request.url);
    const skipStripe = searchParams.get("skipStripe") === "true";

    // Fetch subscription once and reuse it (already has internal caching)
    const subscription = await getCurrentUserSubscription();
    // Get plan if subscription exists
    const plan = subscription ? await getPlanById(subscription.planId) : null;
    // Resolve limits from plan (ensures all fields are defined)
    const limits = resolvePlanFeatures(plan);

    // Determine subscription interval (monthly/yearly)
    // Optimized: Skip Stripe API call during preload for faster loading
    let interval: "month" | "year" | null = null;
    if (!skipStripe && subscription?.stripeSubscriptionId && plan) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );
        const priceId = stripeSubscription.items.data[0]?.price.id;
        
        if (priceId && plan) {
          if (plan.stripePriceIdMonthly === priceId) {
            interval = "month";
          } else if (plan.stripePriceIdYearly === priceId) {
            interval = "year";
          }
        }
      } catch (error) {
        console.error("Error fetching Stripe subscription interval:", error);
        // Continue without interval if Stripe call fails
      }
    }

    // Add cache headers for better performance
    // Cache for 60 seconds - subscription data doesn't change frequently
    return NextResponse.json(
      {
        subscription,
        plan,
        limits,
        interval,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
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

