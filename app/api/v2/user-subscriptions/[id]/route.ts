import { NextRequest, NextResponse } from "next/server";
import { makeUserSubscriptionsService } from "@/src/application/user-subscriptions/user-subscriptions.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { revalidateTag } from "next/cache";

/**
 * GET /api/v2/user-subscriptions/[id]
 * Get a specific user service subscription by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const service = makeUserSubscriptionsService();
    const subscriptions = await service.getUserSubscriptions(userId);
    const subscription = subscriptions.find((s) => s.id === id);

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subscription, {
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/user-subscriptions/[id]
 * Update a user service subscription
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const service = makeUserSubscriptionsService();
    const subscription = await service.updateUserSubscription(userId, id, body);
    
    // Invalidate cache using tag groups
    revalidateTag('subscriptions', 'max');
    revalidateTag('accounts', 'max');
    
    return NextResponse.json(subscription, { status: 200 });
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

/**
 * DELETE /api/v2/user-subscriptions/[id]
 * Delete a user service subscription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const service = makeUserSubscriptionsService();
    await service.deleteUserSubscription(userId, id);
    
    // Invalidate cache using tag groups
    revalidateTag('subscriptions', 'max');
    revalidateTag('accounts', 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subscription" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/user-subscriptions/[id]
 * Pause or resume a user service subscription
 * Body: { action: "pause" | "resume" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const service = makeUserSubscriptionsService();

    if (action === "pause") {
      const subscription = await service.pauseUserSubscription(userId, id);
      // Invalidate cache using tag groups
      revalidateTag('subscriptions', 'max');
      revalidateTag('accounts', 'max');
      return NextResponse.json(subscription, { status: 200 });
    } else if (action === "resume") {
      const subscription = await service.resumeUserSubscription(userId, id);
      // Invalidate cache using tag groups
      revalidateTag('subscriptions', 'max');
      revalidateTag('accounts', 'max');
      return NextResponse.json(subscription, { status: 200 });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'pause' or 'resume'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error pausing/resuming subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to pause/resume subscription" },
      { status: 500 }
    );
  }
}

