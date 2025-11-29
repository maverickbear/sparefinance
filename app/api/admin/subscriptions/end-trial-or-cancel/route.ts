import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "../../../../src/infrastructure/database/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return userData?.role === "super_admin";
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return false;
  }
}

/**
 * PUT /api/admin/subscriptions/end-trial-or-cancel
 * End trial immediately or cancel subscription
 * Only accessible by super_admin
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { subscriptionId, action } = body; // action: "end_trial" | "cancel"

    if (!subscriptionId || !action) {
      return NextResponse.json(
        { error: "subscriptionId and action are required. Action must be 'end_trial' or 'cancel'" },
        { status: 400 }
      );
    }

    if (action !== "end_trial" && action !== "cancel") {
      return NextResponse.json(
        { error: "Action must be 'end_trial' or 'cancel'" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get subscription to verify it exists and get userId/stripeSubscriptionId
    const { data: subscription, error: subError } = await serviceSupabase
      .from("Subscription")
      .select("id, userId, stripeSubscriptionId, status, trialEndDate")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      console.error("[ADMIN:END-TRIAL-OR-CANCEL] Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (!subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Subscription does not have a Stripe subscription ID" },
        { status: 400 }
      );
    }

    console.log("[ADMIN:END-TRIAL-OR-CANCEL] Processing action:", {
      action,
      subscriptionId: subscription.id,
      userId: subscription.userId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentStatus: subscription.status,
    });

    let updatedSubscription;
    let stripeUpdate: any = {};

    if (action === "end_trial") {
      // End trial immediately by setting trial_end to now
      if (subscription.status !== "trialing") {
        return NextResponse.json(
          { error: "Subscription is not in trial period" },
          { status: 400 }
        );
      }

      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      stripeUpdate.trial_end = now;

      // Update in Supabase
      const { data: updated, error: updateError } = await serviceSupabase
        .from("Subscription")
        .update({
          trialEndDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        console.error("[ADMIN:END-TRIAL-OR-CANCEL] Error updating subscription in Supabase:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription in database" },
          { status: 500 }
        );
      }

      updatedSubscription = updated;
    } else if (action === "cancel") {
      // Cancel subscription completely - no need for stripeUpdate since we'll cancel directly

      // Update in Supabase first
      const { data: updated, error: updateError } = await serviceSupabase
        .from("Subscription")
        .update({
          status: "cancelled",
          cancelAtPeriodEnd: false,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        console.error("[ADMIN:END-TRIAL-OR-CANCEL] Error updating subscription in Supabase:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription in database" },
          { status: 500 }
        );
      }

      updatedSubscription = updated;
    }

    // Update in Stripe
    try {
      if (action === "cancel") {
        // Cancel subscription immediately in Stripe
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        console.log("[ADMIN:END-TRIAL-OR-CANCEL] Subscription cancelled in Stripe");
      } else {
        // End trial immediately by setting trial_end to now
        const stripeSub = await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          stripeUpdate
        );
        console.log("[ADMIN:END-TRIAL-OR-CANCEL] Trial ended in Stripe:", {
          subscriptionId: stripeSub.id,
          trialEnd: stripeSub.trial_end,
        });
      }
    } catch (stripeError) {
      console.error("[ADMIN:END-TRIAL-OR-CANCEL] Error updating subscription in Stripe:", stripeError);
      // Note: We don't fail here because Supabase is already updated
      return NextResponse.json(
        {
          success: true,
          warning: `Updated in database but failed to sync with Stripe: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
          subscription: updatedSubscription,
        },
        { status: 200 }
      );
    }

    // Invalidate cache
    const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
    await invalidateSubscriptionCache(subscription.userId);
    console.log("[ADMIN:END-TRIAL-OR-CANCEL] Subscription cache invalidated for user:", subscription.userId);

    return NextResponse.json({
      success: true,
      message: action === "end_trial" 
        ? "Trial ended successfully" 
        : "Subscription cancelled successfully",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("[ADMIN:END-TRIAL-OR-CANCEL] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

