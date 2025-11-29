import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { createPortalSession } from "@/lib/api/stripe";

/**
 * DEPRECATED: This route should not be used for plan changes.
 * All plan changes must be done through Stripe Customer Portal.
 * The webhook will automatically update the Supabase database when changes are made in Stripe.
 * 
 * This route now redirects to Stripe Customer Portal for consistency.
 */
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

    // CRITICAL: All plan changes must be done through Stripe Customer Portal
    // The webhook will automatically update Supabase when changes are made in Stripe
    // Redirect to Stripe Customer Portal instead of making local changes
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
      message: "Redirecting to Stripe Customer Portal to manage your subscription. All plan changes must be made through Stripe.",
    });
  } catch (error) {
    console.error("[UPDATE_SUBSCRIPTION_PLAN] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create portal session" },
      { status: 500 }
    );
  }
}

