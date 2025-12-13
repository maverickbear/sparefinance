import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { logger } from "@/src/infrastructure/utils/logger";

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

    const stripeService = makeStripeService();
    const customerInfo = await stripeService.getCustomerInfo(userId);

    return NextResponse.json(customerInfo);
  } catch (error) {
    logger.error("[STRIPE/CUSTOMER] Error:", error);
    
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

