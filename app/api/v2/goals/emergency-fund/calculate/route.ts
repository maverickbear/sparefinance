import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * POST /api/v2/goals/emergency-fund/calculate
 * Calculate and update emergency fund goal based on income and expenses
 * Note: The emergency fund goal must exist before calling this endpoint.
 * Users must create the goal manually.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get access tokens from cookies if available
    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    const service = makeGoalsService();
    const goal = await service.calculateAndUpdateEmergencyFund(accessToken, refreshToken);
    
    if (!goal) {
      return NextResponse.json(
        { error: "Emergency fund goal not found. Please create the goal first before calculating." },
        { status: 404 }
      );
    }

    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error calculating emergency fund:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to calculate emergency fund";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

