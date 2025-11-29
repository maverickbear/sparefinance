import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, createTrialCheckoutSession } from "@/lib/api/stripe";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, interval = "month", returnUrl, promoCode, isTrial = false } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Build return URL - use provided returnUrl or default to subscription success page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
    const finalReturnUrl = returnUrl 
      ? `${baseUrl}${returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`}`
      : `${baseUrl}/subscription/success`;

    // For trial checkout, allow unauthenticated users
    if (isTrial) {
      const { url, error } = await createTrialCheckoutSession(planId, interval, finalReturnUrl, promoCode);
      
      if (error || !url) {
        return NextResponse.json(
          { error: error || "Failed to create checkout session" },
          { status: 500 }
        );
      }

      return NextResponse.json({ url });
    }

    // For regular checkout, require authentication
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create checkout session
    const { url, error } = await createCheckoutSession(authUser.id, planId, interval, finalReturnUrl, promoCode);

    if (error || !url) {
      return NextResponse.json(
        { error: error || "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

