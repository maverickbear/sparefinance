import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/**
 * GET /api/stripe/customer
 * Returns the Stripe customer ID and email for the current user
 * Used by Stripe Pricing Table to pre-fill customer information
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get subscription with stripeCustomerId
    const { data: subscription, error: subError } = await supabase
      .from("Subscription")
      .select("stripeCustomerId")
      .eq("userId", authUser.id)
      .not("stripeCustomerId", "is", null)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[STRIPE/CUSTOMER] Error fetching subscription:", subError);
    }

    return NextResponse.json({
      customerId: subscription?.stripeCustomerId || null,
      customerEmail: authUser.email || null,
      userId: authUser.id || null,
    });
  } catch (error) {
    console.error("[STRIPE/CUSTOMER] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer information" },
      { status: 500 }
    );
  }
}

