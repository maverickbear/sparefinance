import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { invalidateSubscriptionCache } from "@/lib/api/plans";
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
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription or trial
    const { data: existingSubscriptions, error: subError } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", authUser.id)
      .in("status", ["active", "trialing"])
      .order("createdAt", { ascending: false });

    if (subError) {
      console.error("[START-TRIAL] Error checking existing subscriptions:", subError);
      return NextResponse.json(
        { error: "Failed to check existing subscriptions" },
        { status: 500 }
      );
    }

    // If user already has an active subscription or trial, return error
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      return NextResponse.json(
        { error: "User already has an active subscription or trial" },
        { status: 400 }
      );
    }

    // Check if user already had a trial before (cancelled subscription with trialEndDate)
    const { data: cancelledSubscriptions, error: cancelledError } = await supabase
      .from("Subscription")
      .select("trialEndDate")
      .eq("userId", authUser.id)
      .eq("status", "cancelled")
      .not("trialEndDate", "is", null)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cancelledError && cancelledError.code !== "PGRST116") {
      console.error("[START-TRIAL] Error checking cancelled subscriptions:", cancelledError);
    }

    // If user already had a trial (cancelled subscription with trialEndDate), don't allow another trial
    if (cancelledSubscriptions && cancelledSubscriptions.trialEndDate) {
      return NextResponse.json(
        { error: "You have already used your trial period. Please subscribe to a plan." },
        { status: 400 }
      );
    }

    // Calculate trial dates (30 days from now)
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    // Get or create Stripe customer
    let customerId: string;
    const { data: existingSubscription } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", authUser.id)
      .not("stripeCustomerId", "is", null)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get user name from User table
    const { data: userData } = await supabase
      .from("User")
      .select("name")
      .eq("id", authUser.id)
      .single();

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
      console.log("[START-TRIAL] Using existing Stripe customer:", customerId);
      
      // Update existing customer with current email and name
      try {
        await stripe.customers.update(customerId, {
          email: authUser.email!,
          name: userData?.name || undefined,
          metadata: {
            userId: authUser.id,
          },
        });
        console.log("[START-TRIAL] Updated existing Stripe customer with email and name:", { 
          customerId, 
          email: authUser.email, 
          name: userData?.name 
        });
      } catch (updateError) {
        console.error("[START-TRIAL] Error updating existing Stripe customer:", updateError);
        // Continue anyway - customer exists, just couldn't update
      }
    } else {
      // Create Stripe customer
      console.log("[START-TRIAL] Creating new Stripe customer for user:", authUser.id);
      const customer = await stripe.customers.create({
        email: authUser.email!,
        name: userData?.name || undefined,
        metadata: {
          userId: authUser.id,
        },
      });
      customerId = customer.id;
      console.log("[START-TRIAL] Stripe customer created:", { customerId, email: authUser.email, name: userData?.name });
    }

    // Get price ID (default to monthly)
    const priceId = plan.stripePriceIdMonthly;
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price ID not configured for this plan" },
        { status: 400 }
      );
    }

    // Create subscription in Stripe with trial period
    // Using payment_behavior: "default_incomplete" allows trial without payment method
    // The subscription will be in "incomplete" status until payment method is added
    console.log("[START-TRIAL] Creating Stripe subscription with trial:", { customerId, priceId });
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 30,
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId: authUser.id,
        planId: planId,
      },
    });

    console.log("[START-TRIAL] Stripe subscription created:", {
      subscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      trialEnd: stripeSubscription.trial_end,
    });

    // Create subscription in database
    // Use same ID format as webhook handler: userId + "-" + planId
    const subscriptionId = `${authUser.id}-${planId}`;
    const { data: newSubscription, error: insertError } = await supabase
      .from("Subscription")
      .insert({
        id: subscriptionId,
        userId: authUser.id,
        planId: planId,
        status: "trialing",
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        trialStartDate: trialStartDate.toISOString(),
        trialEndDate: trialEndDate.toISOString(),
        currentPeriodStart: stripeSubscription.trial_start 
          ? new Date(stripeSubscription.trial_start * 1000).toISOString()
          : trialStartDate.toISOString(),
        currentPeriodEnd: stripeSubscription.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : trialEndDate.toISOString(),
        cancelAtPeriodEnd: false,
      })
      .select()
      .single();

    if (insertError || !newSubscription) {
      console.error("[START-TRIAL] Error creating subscription:", insertError);
      // If database insert fails, cancel the Stripe subscription
      try {
        await stripe.subscriptions.cancel(stripeSubscription.id);
        console.log("[START-TRIAL] Stripe subscription cancelled due to database error");
      } catch (cancelError) {
        console.error("[START-TRIAL] Error cancelling Stripe subscription:", cancelError);
      }
      return NextResponse.json(
        { error: "Failed to create trial subscription" },
        { status: 500 }
      );
    }

    // Invalidate subscription cache
    await invalidateSubscriptionCache(authUser.id);

    console.log("[START-TRIAL] Trial started successfully:", {
      subscriptionId: newSubscription.id,
      stripeSubscriptionId: stripeSubscription.id,
      planId: planId,
      trialEndDate: trialEndDate.toISOString(),
    });

    return NextResponse.json({
      success: true,
      subscription: newSubscription,
      trialEndDate: trialEndDate.toISOString(),
    });
  } catch (error) {
    console.error("[START-TRIAL] Error starting trial:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start trial" },
      { status: 500 }
    );
  }
}

