import { NextResponse } from "next/server";
import { getCurrentUserSubscription, checkPlanLimits } from "@/lib/api/plans";
import { createServerClient } from "@/lib/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch subscription once and reuse it
    const subscription = await getCurrentUserSubscription();
    // Pass subscription to checkPlanLimits to avoid duplicate fetch
    const { plan, limits } = await checkPlanLimits(authUser.id, subscription);

    // Determine subscription interval (monthly/yearly)
    let interval: "month" | "year" | null = null;
    if (subscription?.stripeSubscriptionId && plan) {
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

    return NextResponse.json({
      subscription,
      plan,
      limits,
      interval,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

