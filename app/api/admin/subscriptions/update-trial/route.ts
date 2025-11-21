import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";
import { updateSubscriptionTrial } from "@/lib/api/stripe";

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
 * PUT /api/admin/subscriptions/update-trial
 * Update trial end date for a subscription (Supabase → Stripe)
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
    const { subscriptionId, trialEndDate } = body;

    if (!subscriptionId || !trialEndDate) {
      return NextResponse.json(
        { error: "subscriptionId and trialEndDate are required" },
        { status: 400 }
      );
    }

    // Validate and parse trialEndDate
    let trialEnd: Date;
    try {
      trialEnd = new Date(trialEndDate);
      if (isNaN(trialEnd.getTime())) {
        return NextResponse.json(
          { error: "Invalid trialEndDate format. Expected ISO date string." },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid trialEndDate format. Expected ISO date string." },
        { status: 400 }
      );
    }

    // Validate that trialEndDate is in the future
    const now = new Date();
    if (trialEnd <= now) {
      return NextResponse.json(
        { error: "Trial end date must be in the future" },
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
      console.error("[ADMIN:UPDATE-TRIAL] Error fetching subscription:", subError);
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

    console.log("[ADMIN:UPDATE-TRIAL] Updating trial for subscription:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentTrialEndDate: subscription.trialEndDate,
      newTrialEndDate: trialEnd.toISOString(),
    });

    // Step 1: Update in Supabase first
    const { data: updatedSub, error: updateError } = await serviceSupabase
      .from("Subscription")
      .update({
        trialEndDate: trialEnd.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (updateError) {
      console.error("[ADMIN:UPDATE-TRIAL] Error updating subscription in Supabase:", updateError);
      return NextResponse.json(
        { error: "Failed to update subscription in database" },
        { status: 500 }
      );
    }

    console.log("[ADMIN:UPDATE-TRIAL] Updated subscription in Supabase:", updatedSub);

    // Step 2: Update in Stripe (this will trigger webhook that syncs back, but we already have the correct value)
    const stripeResult = await updateSubscriptionTrial(subscription.userId, trialEnd);

    if (!stripeResult.success) {
      console.error("[ADMIN:UPDATE-TRIAL] Error updating subscription in Stripe:", stripeResult.error);
      // Note: We don't fail here because Supabase is already updated
      // The webhook will eventually sync, but we log the error
      return NextResponse.json(
        {
          success: true,
          warning: `Updated in database but failed to sync with Stripe: ${stripeResult.error}`,
          subscription: updatedSub,
        },
        { status: 200 }
      );
    }

    console.log("[ADMIN:UPDATE-TRIAL] Successfully updated trial in both Supabase and Stripe");

    return NextResponse.json({
      success: true,
      message: "Trial end date updated successfully in both Supabase and Stripe",
      subscription: updatedSub,
    });
  } catch (error) {
    console.error("[ADMIN:UPDATE-TRIAL] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update trial" },
      { status: 500 }
    );
  }
}

