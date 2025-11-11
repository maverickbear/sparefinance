import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

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
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from("Plan")
      .select("id")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Get current active subscription
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("id, planId, status")
      .eq("userId", authUser.id)
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[UPDATE_SUBSCRIPTION_PLAN] Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // If already on the target plan, return success
    if (subscription.planId === planId) {
      return NextResponse.json({
        success: true,
        message: "Already on this plan",
      });
    }

    // Update subscription plan
    const { error: updateError } = await supabase
      .from("Subscription")
      .update({ planId })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("[UPDATE_SUBSCRIPTION_PLAN] Error updating subscription:", updateError);
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription plan updated successfully",
    });
  } catch (error) {
    console.error("[UPDATE_SUBSCRIPTION_PLAN] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subscription plan" },
      { status: 500 }
    );
  }
}

