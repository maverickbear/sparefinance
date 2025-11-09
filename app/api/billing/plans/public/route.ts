import { NextResponse } from "next/server";
import { getPlans } from "@/lib/api/plans";

/**
 * Public endpoint to fetch plans without authentication
 * Used for landing page pricing section
 */
export async function GET() {
  try {
    const plans = await getPlans();
    
    return NextResponse.json({
      plans,
    });
  } catch (error) {
    console.error("[API/BILLING/PLANS/PUBLIC] Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

