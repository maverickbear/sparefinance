import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";
import { makeMembersService } from "@/src/application/members/members.factory";

/**
 * GET /api/v2/user
 * Returns user data with plan and subscription information
 * Consolidates data from User table, subscription, and plan
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    // Get user data from User table
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, email, name, avatarUrl, role")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get subscription and plan data
    const { getCurrentUserSubscriptionData } = await import("@/lib/api/subscription");
    const subscriptionData = await getCurrentUserSubscriptionData();
    
    // Get user role (temporary: using old function until migrated to service)
    const { getUserRoleOptimized } = await import("@/lib/api/members");
    const userRole = await getUserRoleOptimized(userId);
    
    const user = {
      id: userData.id,
      email: userData.email,
      name: userData.name || null,
      avatarUrl: userData.avatarUrl || null,
    };

    const plan = subscriptionData.plan ? {
      id: subscriptionData.plan.id,
      name: subscriptionData.plan.name,
    } : null;

    const subscription = subscriptionData.subscription ? {
      status: subscriptionData.subscription.status as "active" | "trialing" | "cancelled" | "past_due",
      trialEndDate: subscriptionData.subscription.trialEndDate || null,
    } : null;

    return NextResponse.json({
      user,
      plan,
      subscription,
      userRole,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

