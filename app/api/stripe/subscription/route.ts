import { NextRequest, NextResponse } from "next/server";
import { 
  updateSubscriptionPlan, 
  cancelSubscription, 
  reactivateSubscription 
} from "@/lib/api/stripe";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export async function PUT(request: NextRequest) {
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
    const { planId, interval = "month" } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    const { success, error } = await updateSubscriptionPlan(
      authUser.id,
      planId,
      interval
    );

    if (!success) {
      return NextResponse.json(
        { error: error || "Failed to update subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}

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
    const { action, cancelImmediately = false } = body;

    if (action === "cancel") {
      const { success, error } = await cancelSubscription(
        authUser.id,
        cancelImmediately
      );

      if (!success) {
        return NextResponse.json(
          { error: error || "Failed to cancel subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else if (action === "reactivate") {
      const { success, error } = await reactivateSubscription(authUser.id);

      if (!success) {
        return NextResponse.json(
          { error: error || "Failed to reactivate subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'cancel' or 'reactivate'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing subscription action:", error);
    return NextResponse.json(
      { error: "Failed to process subscription action" },
      { status: 500 }
    );
  }
}

