import { NextRequest, NextResponse } from "next/server";
import {
  getUserSubscriptions,
  createUserSubscription,
} from "@/lib/api/user-subscriptions";
import { invalidateSubscriptionCaches } from "@/src/infrastructure/cache/cache.manager";

export async function GET(request: NextRequest) {
  try {
    const subscriptions = await getUserSubscriptions();
    return NextResponse.json(subscriptions, { status: 200 });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subscription = await createUserSubscription(body);
    // Invalidate cache to ensure dashboard shows new subscription
    invalidateSubscriptionCaches();
    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subscription" },
      { status: 500 }
    );
  }
}

