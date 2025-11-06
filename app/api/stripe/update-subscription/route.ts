import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import Stripe from "stripe";

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
      console.error("[UPDATE_SUBSCRIPTION] Error fetching subscription:", subError);
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

    // Get target plan
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("[UPDATE_SUBSCRIPTION] Plan not found:", { planId, planError });
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const currentPlanId = subscription.planId;
    const targetPlanId = planId;

    // If downgrading to free, we need to cancel the subscription
    if (targetPlanId === "free") {
      // Cancel at period end
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      return NextResponse.json({
        success: true,
        message: "Subscription will be cancelled at the end of the current period",
        subscription: updatedSubscription,
      });
    }

    // If upgrading or changing to another paid plan
    const priceId = interval === "month" 
      ? plan.stripePriceIdMonthly 
      : plan.stripePriceIdYearly;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price ID not configured for this plan" },
        { status: 400 }
      );
    }

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Determine if this is an upgrade or downgrade
    const { data: currentPlanData } = await supabase
      .from("Plan")
      .select("priceMonthly")
      .eq("id", currentPlanId)
      .single();

    const isUpgrade = currentPlanData && plan.priceMonthly > currentPlanData.priceMonthly;

    // For upgrades, apply immediately with proration
    if (isUpgrade) {
      const updateParams: Stripe.SubscriptionUpdateParams = {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: priceId,
        }],
        proration_behavior: "always_invoice",
      };

      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateParams
      );

      return NextResponse.json({
        success: true,
        message: "Subscription upgraded successfully",
        subscription: updatedSubscription,
      });
    }

    // For downgrades, we need to schedule the change for the end of the current period
    // First, check if there's already a schedule
    const existingSchedules = await stripe.subscriptionSchedules.list({
      customer: subscription.stripeCustomerId!,
      limit: 10,
    });

    // Cancel any existing schedules for this subscription
    for (const schedule of existingSchedules.data) {
      if (schedule.subscription === subscription.stripeSubscriptionId) {
        await stripe.subscriptionSchedules.cancel(schedule.id);
      }
    }

    // Create a subscription schedule that starts at the end of the current period
    const currentPeriodEnd = stripeSubscription.current_period_end;

    // Create schedule with two phases:
    // 1. Current phase (until period end) - keep current plan
    // 2. New phase (after period end) - new plan
    const schedule = await stripe.subscriptionSchedules.create({
      customer: subscription.stripeCustomerId!,
      start_date: Math.floor(Date.now() / 1000), // Start now
      end_behavior: "release",
      phases: [
        {
          // Current phase - keep existing items until period end
          items: stripeSubscription.items.data.map(item => ({
            price: item.price.id,
            quantity: item.quantity,
          })),
          end_date: currentPeriodEnd,
        },
        {
          // New phase - new plan after period end
          items: [{
            price: priceId,
            quantity: 1,
          }],
        },
      ],
    });

    // Link the schedule to the subscription
    await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        schedule: schedule.id,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Subscription will be downgraded at the end of the current period",
      schedule: schedule.id,
    });
  } catch (error) {
    console.error("[UPDATE_SUBSCRIPTION] Error updating subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subscription" },
      { status: 500 }
    );
  }
}

