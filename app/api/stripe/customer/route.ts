import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { AppError } from "@/src/application/shared/app-error";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * GET /api/stripe/customer
 * Returns the Stripe customer ID and email for the current user
 * Used by Stripe Pricing Table to pre-fill customer information
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user email from auth
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get subscription data (uses cached function)
    const subscriptionData = await getCachedSubscriptionData(userId);

    return NextResponse.json({
      customerId: subscriptionData.subscription?.stripeCustomerId || null,
      customerEmail: authUser.email || null,
      userId: authUser.id || null,
    });
  } catch (error) {
    console.error("[STRIPE/CUSTOMER] Error:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch customer information" },
      { status: 500 }
    );
  }
}

