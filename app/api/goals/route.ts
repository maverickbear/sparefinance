import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoalsInternal } from "@/lib/api/goals";
import { createGoal } from "@/lib/api/goals";

export async function GET(request: NextRequest) {
  try {
    // Get tokens from cookies to pass to getGoalsInternal
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    const refreshToken = cookieStore.get("sb-refresh-token")?.value;
    
    // Call getGoalsInternal directly with tokens to bypass cache
    const goals = await getGoalsInternal(accessToken, refreshToken);
    
    console.log("[API/GOALS] Goals fetched:", goals?.length || 0, "goals");
    return NextResponse.json(goals, { status: 200 });
  } catch (error) {
    console.error("[API/GOALS] Error fetching goals:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch goals";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const goal = await createGoal({
      name: body.name,
      targetAmount: body.targetAmount,
      currentBalance: body.currentBalance,
      incomePercentage: body.incomePercentage,
      priority: body.priority,
      description: body.description,
      expectedIncome: body.expectedIncome,
      targetMonths: body.targetMonths,
      accountId: body.accountId,
      holdingId: body.holdingId,
    });
    
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to create goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

