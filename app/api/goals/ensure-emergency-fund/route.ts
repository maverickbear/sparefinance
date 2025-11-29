import { NextRequest, NextResponse } from "next/server";
import { ensureEmergencyFundGoal } from "@/lib/api/goals";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getActiveHouseholdId } from "@/lib/utils/household";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const householdId = await getActiveHouseholdId(userId);
    if (!householdId) {
      return NextResponse.json({ error: "No active household found" }, { status: 400 });
    }

    const goal = await ensureEmergencyFundGoal(userId, householdId);
    
    if (!goal) {
      return NextResponse.json({ error: "Failed to create emergency fund goal" }, { status: 500 });
    }

    return NextResponse.json({ goal }, { status: 200 });
  } catch (error) {
    console.error("Error ensuring emergency fund goal:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to ensure emergency fund goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

