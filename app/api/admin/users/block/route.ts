import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

async function isSuperAdmin(): Promise<{ isAdmin: boolean; userId: string | null }> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { isAdmin: false, userId: null };
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return { isAdmin: userData?.role === "super_admin", userId: user.id };
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return { isAdmin: false, userId: null };
  }
}

/**
 * PUT /api/admin/users/block
 * Block or unblock a user
 * When blocked, user cannot log in and subscription is paused
 * Only accessible by super_admin
 */
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin, userId: adminUserId } = await isSuperAdmin();
    if (!isAdmin || !adminUserId) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, isBlocked, reason } = body;

    if (!userId || typeof isBlocked !== "boolean") {
      return NextResponse.json(
        { error: "userId and isBlocked (boolean) are required" },
        { status: 400 }
      );
    }

    if (isBlocked && !reason) {
      return NextResponse.json(
        { error: "reason is required when blocking a user" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get user to verify it exists
    const { data: user, error: userError } = await serviceSupabase
      .from("User")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      console.error("[ADMIN:BLOCK] Error fetching user:", userError);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's subscription if exists
    const { data: subscription } = await serviceSupabase
      .from("Subscription")
      .select("id, stripeSubscriptionId, status")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("[ADMIN:BLOCK] Processing block/unblock:", {
      userId,
      isBlocked,
      hasSubscription: !!subscription,
      subscriptionStatus: subscription?.status,
    });

    // Update user's blocked status
    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from("User")
      .update({
        isBlocked,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("[ADMIN:BLOCK] Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    // Save to block history
    if (isBlocked && reason) {
      const { error: historyError } = await serviceSupabase
        .from("UserBlockHistory")
        .insert({
          userId,
          action: "block",
          reason: reason.trim(),
          blockedBy: adminUserId,
        });

      if (historyError) {
        console.error("[ADMIN:BLOCK] Error saving block history:", historyError);
        // Don't fail the request if history save fails
      }
    }

    // If user has an active subscription, pause/resume it in Stripe
    if (subscription && subscription.stripeSubscriptionId) {
      try {
        if (isBlocked) {
          // Pause subscription
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            pause_collection: {
              behavior: "keep_as_draft",
            },
          });
          console.log("[ADMIN:BLOCK] Subscription paused in Stripe");
        } else {
          // Resume subscription
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            pause_collection: null,
          });
          console.log("[ADMIN:BLOCK] Subscription resumed in Stripe");
        }
      } catch (stripeError) {
        console.error("[ADMIN:BLOCK] Error updating subscription in Stripe:", stripeError);
        // Continue even if Stripe update fails - user is still blocked in database
      }
    }

    return NextResponse.json({
      success: true,
      message: isBlocked ? "User blocked successfully" : "User unblocked successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[ADMIN:BLOCK] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to block/unblock user" },
      { status: 500 }
    );
  }
}

