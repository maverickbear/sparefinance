import { NextRequest, NextResponse } from "next/server";
import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";


export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const selectedDate = dateParam ? new Date(dateParam) : new Date();

    // Pass userId for cache key, but let function get tokens itself (not in cache context)
    const financialHealth = await calculateFinancialHealth(selectedDate, userId);
    return NextResponse.json(financialHealth);
  } catch (error: any) {
    console.error("Error calculating financial health:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate Spare Score" },
      { status: 500 }
    );
  }
}

