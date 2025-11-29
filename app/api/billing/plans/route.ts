import { NextResponse } from "next/server";
import { getPlans, getCurrentUserSubscriptionData } from "@/lib/api/subscription";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function GET() {
  console.log("[API/BILLING/PLANS] GET request received");
  try {
    console.log("[API/BILLING/PLANS] Fetching plans");
    const plans = await getPlans();
    console.log("[API/BILLING/PLANS] Plans fetched:", plans.length, "plans");

    // Get current user's plan and interval (optional - only if authenticated)
    let currentPlanId: string | undefined;
    let currentInterval: "month" | "year" | null = null;
    try {
      console.log("[API/BILLING/PLANS] Creating server client");
      const supabase = await createServerClient();
      console.log("[API/BILLING/PLANS] Getting user");
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      // If user is not authenticated, return plans without currentPlanId (public access)
      if (authError || !authUser) {
        console.log("[API/BILLING/PLANS] User not authenticated, returning public plans:", { authError: authError?.message, hasUser: !!authUser });
        return NextResponse.json({
          plans,
          currentPlanId: undefined,
          currentInterval: null,
        });
      }
      
      console.log("[API/BILLING/PLANS] User authenticated:", authUser.id);
      // User is authenticated, get their subscription data using unified API
      console.log("[API/BILLING/PLANS] Getting current user subscription data");
      const { subscription, plan } = await getCurrentUserSubscriptionData();
      console.log("[API/BILLING/PLANS] Subscription:", subscription);
      // getCurrentUserSubscriptionData returns null subscription if user has no subscription
      // User must select a plan on /select-plan page
      if (subscription && plan) {
        currentPlanId = subscription.planId;
        console.log("[API/BILLING/PLANS] Current plan ID:", currentPlanId);
        
        // Determine interval from Stripe
        if (subscription.stripeSubscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              subscription.stripeSubscriptionId
            );
            const priceId = stripeSubscription.items.data[0]?.price.id;
            
            if (priceId && plan) {
              if (plan.stripePriceIdMonthly === priceId) {
                currentInterval = "month";
              } else if (plan.stripePriceIdYearly === priceId) {
                currentInterval = "year";
              }
            }
            console.log("[API/BILLING/PLANS] Current interval:", currentInterval);
          } catch (error) {
            console.error("[API/BILLING/PLANS] Error fetching Stripe subscription interval:", error);
          }
        }
      } else {
        // If subscription is null, user is authenticated but no subscription found
        // Return undefined so user can select a plan
        currentPlanId = undefined;
        console.log("[API/BILLING/PLANS] No subscription found, user must select a plan");
      }
    } catch (error) {
      // Error occurred, but still return plans (public access)
      console.error("[API/BILLING/PLANS] Error checking authentication, returning public plans:", error);
      return NextResponse.json({
        plans,
        currentPlanId: undefined,
        currentInterval: null,
      });
    }

    console.log("[API/BILLING/PLANS] Returning response:", { plansCount: plans.length, currentPlanId, currentInterval });
    return NextResponse.json({
      plans,
      currentPlanId,
      currentInterval,
    });
  } catch (error) {
    console.error("[API/BILLING/PLANS] Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

