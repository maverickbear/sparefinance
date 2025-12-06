import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/goals/income-basis
 * Calculate income basis from last 3 months of income transactions
 * or use expectedIncome if provided
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const expectedIncomeParam = searchParams.get("expectedIncome");
    const expectedIncome = expectedIncomeParam ? parseFloat(expectedIncomeParam) : undefined;

    const service = makeGoalsService();
    const incomeBasis = await service.calculateIncomeBasis(expectedIncome);

    return NextResponse.json({ incomeBasis }, {
    });
  } catch (error) {
    console.error("Error calculating income basis:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate income basis" },
      { status: 500 }
    );
  }
}

