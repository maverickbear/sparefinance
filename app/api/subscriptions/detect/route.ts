import { NextRequest, NextResponse } from "next/server";
import { detectSubscriptionsFromTransactions } from "@/lib/api/subscription-detection";

/**
 * GET /api/subscriptions/detect
 * Detect subscriptions from user's transaction history
 */
export async function GET(request: NextRequest) {
  try {
    const detectedSubscriptions = await detectSubscriptionsFromTransactions();
    
    return NextResponse.json({
      success: true,
      subscriptions: detectedSubscriptions,
      count: detectedSubscriptions.length,
    });
  } catch (error) {
    console.error("Error detecting subscriptions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect subscriptions",
        subscriptions: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

