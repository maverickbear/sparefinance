import { NextRequest, NextResponse } from "next/server";
import { makePlannedPaymentsService } from "@/src/application/planned-payments/planned-payments.factory";
import { PLANNED_HORIZON_DAYS } from "@/src/domain/planned-payments/planned-payments.types";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Parse date filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
    
    const startDate = searchParams.get("startDate") 
      ? new Date(searchParams.get("startDate")!) 
      : today;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : horizonDate;
    const status = (searchParams.get("status") || "scheduled") as "scheduled" | "paid" | "skipped" | "cancelled";
    
    const service = makePlannedPaymentsService();
    
    // OPTIMIZED: Get all counts in a single query instead of 3 separate queries
    // This reduces database load by ~66% and improves response time
    const counts = await service.getCountsByType({
      startDate,
      endDate,
      status,
    });
    
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Error fetching planned payment counts:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch planned payment counts";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

