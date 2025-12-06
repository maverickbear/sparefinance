import { NextRequest, NextResponse } from "next/server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, interval = "month", promoCode } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Require authentication
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create subscription (trial)
    const stripeService = makeStripeService();
    const result = await stripeService.createEmbeddedCheckoutSession(
      authUser.id,
      planId,
      interval,
      promoCode
    );
    const { success, subscriptionId, error } = result;

    if (error || !success || !subscriptionId) {
      return NextResponse.json(
        { error: error || "Failed to create subscription" },
        { status: 500 }
      );
    }


    return NextResponse.json({ success: true, subscriptionId, userId: authUser.id });
  } catch (error) {
    console.error("Error creating embedded checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create embedded checkout session" },
      { status: 500 }
    );
  }
}

