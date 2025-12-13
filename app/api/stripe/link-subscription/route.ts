import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

/**
 * POST /api/stripe/link-subscription
 * Links a Stripe subscription to a user account by email
 * Used when a user signs up after completing checkout
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Verify that the email matches the authenticated user
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (authUser.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match authenticated user" },
        { status: 400 }
      );
    }

    const stripeService = makeStripeService();
    const result = await stripeService.linkSubscriptionByEmail(userId, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message },
        { status: result.error === "No Stripe customer found with this email" ? 404 : 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error("[LINK-SUBSCRIPTION] Error:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to link subscription" },
      { status: 500 }
    );
  }
}

