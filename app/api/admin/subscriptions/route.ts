import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase-server";

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
 * GET /api/admin/subscriptions
 * Get all subscriptions with their plans
 * Only accessible by super_admin
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Get all subscriptions with their plans
    const { data: subscriptions, error: subsError } = await serviceSupabase
      .from("Subscription")
      .select(`
        id,
        userId,
        planId,
        status,
        trialStartDate,
        trialEndDate,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        stripeSubscriptionId,
        plan:Plan(
          id,
          name,
          priceMonthly,
          priceYearly
        )
      `)
      .order("createdAt", { ascending: false });

    if (subsError) {
      console.error("[ADMIN:SUBSCRIPTIONS] Error fetching subscriptions:", subsError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    // Transform the data to handle plan as array or object
    const transformedSubscriptions = (subscriptions || []).map((sub: any) => ({
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      status: sub.status,
      trialStartDate: sub.trialStartDate,
      trialEndDate: sub.trialEndDate,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      plan: Array.isArray(sub.plan) ? sub.plan[0] : sub.plan,
    }));

    return NextResponse.json({
      subscriptions: transformedSubscriptions,
    });
  } catch (error) {
    console.error("[ADMIN:SUBSCRIPTIONS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

