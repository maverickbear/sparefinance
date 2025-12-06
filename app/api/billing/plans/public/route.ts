import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * Public endpoint to fetch plans without authentication
 * Used for landing page pricing section
 */
export async function GET() {
  noStore();
  try {
    const service = makeSubscriptionsService();
    const plans = await service.getPlans();
    
    return NextResponse.json(
      { plans },
      {
      }
    );
  } catch (error) {
    console.error("[API/BILLING/PLANS/PUBLIC] Error fetching plans:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

