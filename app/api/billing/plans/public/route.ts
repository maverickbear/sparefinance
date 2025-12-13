import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * Public endpoint to fetch plans without authentication
 * Used for landing page pricing section
 * 
 * SECURITY: Returns only public plan data (excludes Stripe IDs)
 */

export async function GET() {
  noStore();
  try {
    const service = makeSubscriptionsService();
    const plans = await service.getPublicPlans();
    
    return NextResponse.json(
      { plans },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
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

