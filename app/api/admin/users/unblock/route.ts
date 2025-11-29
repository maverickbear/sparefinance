import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
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
 * PUT /api/admin/users/unblock
 * Unblock a user
 * When unblocked, user can log in again and subscription is resumed
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
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "reason is required when unblocking a user" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get user to verify it exists
    const { data: user, error: userError } = await serviceSupabase
      .from("User")
      .select("id, email, isBlocked")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      console.error("[ADMIN:UNBLOCK] Error fetching user:", userError);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.isBlocked) {
      return NextResponse.json(
        { error: "User is not currently blocked" },
        { status: 400 }
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

    console.log("[ADMIN:UNBLOCK] Processing unblock:", {
      userId,
      hasSubscription: !!subscription,
      subscriptionStatus: subscription?.status,
    });

    // Update user's blocked status
    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from("User")
      .update({
        isBlocked: false,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("[ADMIN:UNBLOCK] Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    // Save to block history
    const { error: historyError } = await serviceSupabase
      .from("UserBlockHistory")
      .insert({
        userId,
        action: "unblock",
        reason: reason.trim(),
        blockedBy: adminUserId,
      });

    if (historyError) {
      console.error("[ADMIN:UNBLOCK] Error saving unblock history:", historyError);
      // Don't fail the request if history save fails
    }

    // If user has a subscription, resume it in Stripe
    if (subscription && subscription.stripeSubscriptionId) {
      try {
        // Resume subscription
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          pause_collection: null,
        });
        console.log("[ADMIN:UNBLOCK] Subscription resumed in Stripe");
      } catch (stripeError) {
        console.error("[ADMIN:UNBLOCK] Error updating subscription in Stripe:", stripeError);
        // Continue even if Stripe update fails - user is still unblocked in database
      }
    }

    return NextResponse.json({
      success: true,
      message: "User unblocked successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[ADMIN:UNBLOCK] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unblock user" },
      { status: 500 }
    );
  }
}

