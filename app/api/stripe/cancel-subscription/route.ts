import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";
import { createPortalSession } from "@/lib/api/stripe";

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

    // Redirect to Stripe Customer Portal for subscription management
    // All cancellation actions should be done through the Portal
    const portalResult = await createPortalSession(authUser.id);

    if (portalResult.error || !portalResult.url) {
      return NextResponse.json(
        { error: portalResult.error || "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: portalResult.url,
      message: "Redirecting to Stripe Customer Portal to manage your subscription",
    });
  } catch (error) {
    console.error("[CANCEL_SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create portal session" },
      { status: 500 }
    );
  }
}

