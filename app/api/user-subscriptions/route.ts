import { NextRequest, NextResponse } from "next/server";
import { makeUserSubscriptionsService } from "@/src/application/user-subscriptions/user-subscriptions.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { userServiceSubscriptionFormSchema } from "@/src/domain/subscriptions/subscriptions.validations";
import { ZodError } from "zod";

/**
 * GET /api/user-subscriptions
 * DEPRECATED: Use /api/v2/user-subscriptions instead.
 * Get all user service subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeUserSubscriptionsService();
    const subscriptions = await service.getUserSubscriptions(userId);

    return NextResponse.json(subscriptions, {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching user subscriptions:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-subscriptions
 * DEPRECATED: Use /api/v2/user-subscriptions instead.
 * Create a new user service subscription
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with schema
    const validatedData = userServiceSubscriptionFormSchema.parse(body);

    const service = makeUserSubscriptionsService();
    const subscription = await service.createUserSubscription(userId, validatedData);

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("Error creating user subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subscription" },
      { status: 500 }
    );
  }
}

