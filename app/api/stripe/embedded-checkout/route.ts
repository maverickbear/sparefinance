import { NextRequest, NextResponse } from "next/server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { logger } from "@/src/infrastructure/utils/logger";

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
    const { planId, interval = "month", promoCode } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Create subscription (trial)
    const stripeService = makeStripeService();
    const result = await stripeService.createEmbeddedCheckoutSession(
      userId,
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

    return NextResponse.json({ success: true, subscriptionId, userId });
  } catch (error) {
    logger.error("Error creating embedded checkout session:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create embedded checkout session" },
      { status: 500 }
    );
  }
}

