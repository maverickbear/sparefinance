import { NextRequest, NextResponse } from "next/server";
import { getIncomeBasisForGoals } from "@/src/application/goals/get-income-basis";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

/**
 * GET /api/v2/goals/income-basis
 * Calculate income basis from last 3 months of income transactions
 * or use expectedIncome if provided
 * 
 * OPTIMIZED: Uses cached function to prevent duplicate calculations
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

    // OPTIMIZED: Use cached function to prevent duplicate calculations
    // This is especially important since income basis calculation queries 4 months of transactions
    const incomeBasis = await getIncomeBasisForGoals(expectedIncome);

    // Income basis changes when transactions change, use semi-static cache
    const cacheHeaders = getCacheHeaders('semi-static');

    return NextResponse.json({ incomeBasis }, {
      headers: cacheHeaders,
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

