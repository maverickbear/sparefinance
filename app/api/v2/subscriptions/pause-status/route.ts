import { NextRequest, NextResponse } from "next/server";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionsService = makeSubscriptionsService();
    const pauseStatus = await subscriptionsService.isSubscriptionPaused(userId);

    return NextResponse.json(pauseStatus, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error("Error checking subscription pause status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

