import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

// This endpoint syncs the subscription from Stripe to Supabase
// It can be called after checkout to ensure subscription is created
export async function POST(request: NextRequest) {
  try {
    console.log("[SYNC] Starting subscription sync");
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      console.error("[SYNC] Unauthorized:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[SYNC] User authenticated:", { userId: authUser.id });

    // Get user's subscription from Supabase
    const { data: existingSub, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId, stripeSubscriptionId, planId, id")
      .eq("userId", authUser.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[SYNC] Error fetching subscription:", subError);
    }

    console.log("[SYNC] Existing subscription in Supabase:", {
      exists: !!existingSub,
      hasStripeCustomerId: !!existingSub?.stripeCustomerId,
      hasStripeSubscriptionId: !!existingSub?.stripeSubscriptionId,
      planId: existingSub?.planId
    });

    // If no customer ID, try to find customer by email
    let customerId = existingSub?.stripeCustomerId;
    
    if (!customerId) {
      console.log("[SYNC] No customer ID found, searching Stripe by email:", authUser.email);
      try {
        const customers = await stripe.customers.list({
          email: authUser.email!,
          limit: 1,
        });

        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log("[SYNC] Found customer in Stripe:", customerId);
        } else {
          console.log("[SYNC] No customer found in Stripe");
          return NextResponse.json(
            { error: "No Stripe customer found" },
            { status: 404 }
          );
        }
      } catch (error) {
        console.error("[SYNC] Error searching for customer:", error);
        return NextResponse.json(
          { error: "Failed to search for customer" },
          { status: 500 }
        );
      }
    }

    // Get active subscriptions from Stripe
    console.log("[SYNC] Fetching subscriptions from Stripe for customer:", customerId);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    console.log("[SYNC] Found subscriptions in Stripe:", {
      count: subscriptions.data.length,
      subscriptionIds: subscriptions.data.map(s => s.id)
    });

    if (subscriptions.data.length === 0) {
      console.log("[SYNC] No subscriptions found in Stripe");
      return NextResponse.json(
        { error: "No subscriptions found in Stripe" },
        { status: 404 }
      );
    }

    // Get the most recent active subscription
    const activeSubscription = subscriptions.data.find(s => s.status === "active") || subscriptions.data[0];
    
    if (!activeSubscription) {
      console.log("[SYNC] No active subscription found");
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    console.log("[SYNC] Processing subscription:", {
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      priceId: activeSubscription.items.data[0]?.price.id
    });

    // Use service role client to update subscription
    const serviceSupabase = createServiceRoleClient();
    
    // Sync the subscription directly
    const priceId = activeSubscription.items.data[0]?.price.id;
    if (!priceId) {
      console.error("[SYNC] No price ID in subscription");
      return NextResponse.json(
        { error: "No price ID in subscription" },
        { status: 400 }
      );
    }

    // Find plan by price ID
    const { data: plan, error: planError } = await serviceSupabase
      .from("Plan")
      .select("id")
      .or(`stripePriceIdMonthly.eq.${priceId},stripePriceIdYearly.eq.${priceId}`)
      .single();

    if (planError || !plan) {
      console.error("[SYNC] No plan found for price ID:", { priceId, planError });
      return NextResponse.json(
        { error: "No plan found for price ID" },
        { status: 400 }
      );
    }

    console.log("[SYNC] Found plan:", { planId: plan.id, priceId });

    // Map status
    const mapStripeStatus = (status: Stripe.Subscription.Status): "active" | "cancelled" | "past_due" | "trialing" => {
      switch (status) {
        case "active":
          return "active";
        case "canceled":
        case "unpaid":
          return "cancelled";
        case "past_due":
          return "past_due";
        case "trialing":
          return "trialing";
        default:
          return "active";
      }
    };

    const status = mapStripeStatus(activeSubscription.status);
    const subscriptionId = authUser.id + "-" + plan.id;

    console.log("[SYNC] Upserting subscription:", {
      subscriptionId,
      userId: authUser.id,
      planId: plan.id,
      status,
      stripeSubscriptionId: activeSubscription.id,
      stripeCustomerId: customerId
    });

    // Cancel free subscriptions if creating paid one
    if (plan.id !== "free") {
      const { data: freeSubs } = await serviceSupabase
        .from("Subscription")
        .select("id")
        .eq("userId", authUser.id)
        .eq("planId", "free")
        .eq("status", "active");

      if (freeSubs && freeSubs.length > 0) {
        const freeSubIds = freeSubs.map(sub => sub.id);
        await serviceSupabase
          .from("Subscription")
          .update({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .in("id", freeSubIds);
        console.log("[SYNC] Cancelled free subscriptions:", freeSubIds);
      }
    }

    // Get existing subscription to check if trial should be finalized
    const { data: existingSubData } = await serviceSupabase
      .from("Subscription")
      .select("trialStartDate, trialEndDate, status")
      .eq("id", subscriptionId)
      .maybeSingle();

    // Prepare subscription data
    const subscriptionData: any = {
      id: subscriptionId,
      userId: authUser.id,
      planId: plan.id,
      status: status,
      stripeSubscriptionId: activeSubscription.id,
      stripeCustomerId: customerId,
      currentPeriodStart: new Date((activeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((activeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (activeSubscription as any).cancel_at_period_end,
      updatedAt: new Date(),
    };

    // Preserve trial start date if it exists
    if (existingSubData?.trialStartDate) {
      subscriptionData.trialStartDate = existingSubData.trialStartDate;
    } else if ((activeSubscription as any).trial_start) {
      subscriptionData.trialStartDate = new Date((activeSubscription as any).trial_start * 1000);
    }

    // If subscription status is "active" and was previously "trialing", finalize trial immediately
    const wasTrialing = existingSubData?.status === "trialing";
    const isNowActive = status === "active";
    const hasTrialEndDate = existingSubData?.trialEndDate || (activeSubscription as any).trial_end;

    if (isNowActive && wasTrialing && hasTrialEndDate) {
      // Payment was made during trial - finalize trial immediately
      const now = new Date();
      subscriptionData.trialEndDate = now;
      console.log("[SYNC] Payment made during trial - finalizing trial immediately:", {
        subscriptionId,
        previousStatus: existingSubData?.status,
        newStatus: status,
        previousTrialEndDate: existingSubData?.trialEndDate,
        newTrialEndDate: now,
      });
    } else {
      // Preserve trial end date if it exists, or set from Stripe if available
      if (existingSubData?.trialEndDate) {
        subscriptionData.trialEndDate = existingSubData.trialEndDate;
      } else if ((activeSubscription as any).trial_end) {
        subscriptionData.trialEndDate = new Date((activeSubscription as any).trial_end * 1000);
      }
    }

    // Upsert the subscription
    const { data: upsertedSub, error: upsertError } = await serviceSupabase
      .from("Subscription")
      .upsert(subscriptionData, {
        onConflict: "id",
      })
      .select();

    if (upsertError) {
      console.error("[SYNC] Error upserting subscription:", upsertError);
      return NextResponse.json(
        { error: "Failed to sync subscription" },
        { status: 500 }
      );
    }

    console.log("[SYNC] Subscription synced successfully:", upsertedSub);

    return NextResponse.json({
      success: true,
      subscription: upsertedSub?.[0],
    });
  } catch (error) {
    console.error("[SYNC] Error syncing subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}

