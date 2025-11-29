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
 * PUT /api/admin/subscriptions/cancel
 * Cancel subscription with various options (immediately, end of period, specific date)
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
    const { subscriptionId, cancelOption, cancelAt, refundOption } = body;

    if (!subscriptionId || !cancelOption) {
      return NextResponse.json(
        { error: "subscriptionId and cancelOption are required" },
        { status: 400 }
      );
    }

    if (!["immediately", "end_of_period", "specific_date"].includes(cancelOption)) {
      return NextResponse.json(
        { error: "cancelOption must be 'immediately', 'end_of_period', or 'specific_date'" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get subscription
    const { data: subscription, error: subError } = await serviceSupabase
      .from("Subscription")
      .select("id, userId, stripeSubscriptionId, status, currentPeriodEnd")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      console.error("[ADMIN:CANCEL] Error fetching subscription:", subError);
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

    console.log("[ADMIN:CANCEL] Processing cancellation:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      cancelOption,
      cancelAt,
      refundOption,
    });

    let updatedSubscription;
    let stripeUpdate: any = {};

    // Determine cancellation behavior
    if (cancelOption === "immediately") {
      // Cancel immediately - no proration
      stripeUpdate.cancel_at_period_end = false;
      
      // Update in Supabase
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
        console.error("[ADMIN:CANCEL] Error updating subscription in Supabase:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription in database" },
          { status: 500 }
        );
      }

      updatedSubscription = updated;
    } else if (cancelOption === "end_of_period") {
      // Cancel at end of current period
      stripeUpdate.cancel_at_period_end = true;
      
      // Update in Supabase
      const { data: updated, error: updateError } = await serviceSupabase
        .from("Subscription")
        .update({
          cancelAtPeriodEnd: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        console.error("[ADMIN:CANCEL] Error updating subscription in Supabase:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription in database" },
          { status: 500 }
        );
      }

      updatedSubscription = updated;
    } else if (cancelOption === "specific_date") {
      // Cancel at specific date
      if (!cancelAt) {
        return NextResponse.json(
          { error: "cancelAt is required when cancelOption is 'specific_date'" },
          { status: 400 }
        );
      }

      const cancelDate = new Date(cancelAt);
      if (isNaN(cancelDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid cancelAt date format" },
          { status: 400 }
        );
      }

      const cancelTimestamp = Math.floor(cancelDate.getTime() / 1000);
      stripeUpdate.cancel_at = cancelTimestamp;
      
      // Update in Supabase
      const { data: updated, error: updateError } = await serviceSupabase
        .from("Subscription")
        .update({
          cancelAtPeriodEnd: false,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        console.error("[ADMIN:CANCEL] Error updating subscription in Supabase:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription in database" },
          { status: 500 }
        );
      }

      updatedSubscription = updated;
    }

    // Handle refunds if needed
    if (refundOption && refundOption !== "none" && cancelOption === "immediately") {
      // For immediate cancellation with refund, we would need to create a credit note
      // This is a simplified version - in production, you'd want to handle this more carefully
      console.log("[ADMIN:CANCEL] Refund requested:", refundOption);
      // Note: Stripe doesn't automatically handle refunds on subscription cancellation
      // You would need to create a credit note or refund manually
    }

    // Update in Stripe
    try {
      if (cancelOption === "immediately") {
        // Cancel immediately
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        console.log("[ADMIN:CANCEL] Subscription cancelled immediately in Stripe");
      } else {
        // Update subscription with cancel settings
        await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          stripeUpdate
        );
        console.log("[ADMIN:CANCEL] Subscription updated in Stripe:", stripeUpdate);
      }
    } catch (stripeError) {
      console.error("[ADMIN:CANCEL] Error updating subscription in Stripe:", stripeError);
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
    console.log("[ADMIN:CANCEL] Subscription cache invalidated for user:", subscription.userId);

    return NextResponse.json({
      success: true,
      message: "Subscription cancellation processed successfully",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("[ADMIN:CANCEL] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process cancellation" },
      { status: 500 }
    );
  }
}

