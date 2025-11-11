import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import Stripe from "stripe";
import { createCheckoutSession } from "@/lib/api/stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, interval = "month" } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("stripeSubscriptionId, planId, stripeCustomerId")
      .eq("userId", authUser.id)
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[CANCEL_AND_CHECKOUT] Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 }
      );
    }

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active Stripe subscription found" },
        { status: 404 }
      );
    }

    // Cancel the current subscription at period end
    await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Cancel the subscription in the database
    const { error: cancelError } = await supabase
      .from("Subscription")
      .update({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .eq("id", subscription.id);

    if (cancelError) {
      console.error("[CANCEL_AND_CHECKOUT] Error cancelling subscription in database:", cancelError);
      // Continue anyway, as Stripe cancellation was successful
    }

    // Create checkout session for the new plan
    const checkoutResult = await createCheckoutSession(
      authUser.id,
      planId,
      interval,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&success=true`
    );

    if (checkoutResult.error) {
      return NextResponse.json(
        { error: checkoutResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: checkoutResult.url,
      message: "Current subscription cancelled. Redirecting to checkout for new plan.",
    });
  } catch (error) {
    console.error("[CANCEL_AND_CHECKOUT] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process downgrade" },
      { status: 500 }
    );
  }
}

