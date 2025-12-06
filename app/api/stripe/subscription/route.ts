import { NextRequest, NextResponse } from "next/server";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { invalidateUserCaches } from "@/src/infrastructure/utils/cache-utils";

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, interval = "month" } = body;

    if (!planId) {
      throw new AppError("planId is required", 400);
    }

    const stripeService = makeStripeService();
    const result = await stripeService.updateSubscriptionPlan(
      userId,
      planId,
      interval
    );
    const { success, error } = result;

    if (!success) {
      throw new AppError(error || "Failed to update subscription", 500);
    }

    // Invalidate cache for this user
    await invalidateUserCaches(userId, { subscriptions: true, accounts: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subscription" },
      { status: 500 }
    );
  }
}

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
    const { action, cancelImmediately = false } = body;

    if (action === "cancel") {
      const stripeService = makeStripeService();
      const result = await stripeService.cancelSubscription(
        userId,
        cancelImmediately
      );
      const { success, error } = result;

      if (!success) {
        throw new AppError(error || "Failed to cancel subscription", 500);
      }

      // Invalidate cache using tag groups
      revalidateTag('subscriptions', 'max');
      revalidateTag('accounts', 'max');

      return NextResponse.json({ success: true });
    } else if (action === "reactivate") {
      const stripeService = makeStripeService();
      const result = await stripeService.reactivateSubscription(userId);
      const { success, error } = result;

      if (!success) {
        throw new AppError(error || "Failed to reactivate subscription", 500);
      }

      // Invalidate cache using tag groups
      revalidateTag('subscriptions', 'max');
      revalidateTag('accounts', 'max');

      return NextResponse.json({ success: true });
    } else {
      throw new AppError("Invalid action. Use 'cancel' or 'reactivate'", 400);
    }
  } catch (error) {
    console.error("Error processing subscription action:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process subscription action" },
      { status: 500 }
    );
  }
}

