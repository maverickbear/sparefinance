import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { invalidateSubscriptionCache } from "@/lib/api/plans";
import { randomUUID } from "crypto";

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

    // Calculate trial dates (30 days from now)
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    // Create subscription with trial
    const subscriptionId = randomUUID();
    const { data: newSubscription, error: insertError } = await supabase
      .from("Subscription")
      .insert({
        id: subscriptionId,
        userId: authUser.id,
        planId: planId,
        status: "trialing",
        trialStartDate: trialStartDate.toISOString(),
        trialEndDate: trialEndDate.toISOString(),
        cancelAtPeriodEnd: false,
      })
      .select()
      .single();

    if (insertError || !newSubscription) {
      console.error("[START-TRIAL] Error creating subscription:", insertError);
      return NextResponse.json(
        { error: "Failed to create trial subscription" },
        { status: 500 }
      );
    }

    // Invalidate subscription cache
    await invalidateSubscriptionCache(authUser.id);

    console.log("[START-TRIAL] Trial started successfully:", {
      subscriptionId: newSubscription.id,
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
      { error: "Failed to start trial" },
      { status: 500 }
    );
  }
}

