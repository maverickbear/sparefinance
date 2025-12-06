import { NextRequest, NextResponse } from "next/server";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { AppError } from "@/src/application/shared/app-error";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionsService = makeSubscriptionsService();
    
    // Check if user is still in a household with active subscription
    // If so, don't allow resuming (uses cached function)
    const subscriptionData = await getCachedSubscriptionData(userId);
    
    if (subscriptionData.subscription && subscriptionData.subscription.householdId) {
      // User is using household subscription, check if household still has active subscription
      const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
      const subscriptionsRepository = new SubscriptionsRepository();
      const householdSubscription = await subscriptionsRepository.findByHouseholdId(subscriptionData.subscription.householdId);
      
      if (householdSubscription && (householdSubscription.status === "active" || householdSubscription.status === "trialing")) {
        return NextResponse.json(
          { error: "Cannot resume subscription while household subscription is active" },
          { status: 400 }
        );
      }
    }

    const resumeResult = await subscriptionsService.resumeUserSubscription(userId);

    if (!resumeResult.resumed) {
      return NextResponse.json(
        { error: resumeResult.error || "Failed to resume subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resuming subscription:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

