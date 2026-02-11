import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const planId = body.planId as string | undefined;
    const interval = (body.interval === "year" ? "year" : "month") as "month" | "year";
    const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : undefined;
    const promoCode = typeof body.promoCode === "string" ? body.promoCode : undefined;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    const { data: existingSubscriptions } = await supabase
      .from("app_subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingSubscriptions && existingSubscriptions.length > 0) {
      return NextResponse.json(
        { error: "You already have an active subscription or trial." },
        { status: 400 }
      );
    }

    const { data: cancelledWithTrial } = await supabase
      .from("app_subscriptions")
      .select("trial_end_date")
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .not("trial_end_date", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cancelledWithTrial?.trial_end_date) {
      return NextResponse.json(
        { error: "You have already used your trial period. Please subscribe to a plan." },
        { status: 400 }
      );
    }

    const stripeService = makeStripeService();
    const result = await stripeService.createTrialCheckoutSessionForUser(
      userId,
      planId,
      interval,
      returnUrl,
      undefined,
      promoCode
    );

    if (result.error || !result.url) {
      const statusCode =
        result.error === "Unauthorized"
          ? 401
          : result.error === "Plan not found"
            ? 404
            : result.error?.includes("not configured in Stripe") || result.error?.includes("Stripe Price")
              ? 503
              : 500;
      return NextResponse.json(
        { error: result.error || "Failed to create checkout session" },
        { status: statusCode }
      );
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("[BILLING/CHECKOUT-SESSION] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
