import { NextRequest, NextResponse } from "next/server";
import { loadDashboardData } from "@/app/(protected)/dashboard/data-loader";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

type DateRange = "this-month" | "last-month" | "last-60-days" | "last-90-days";

function calculateDateRange(range: DateRange): { startDate: Date; endDate: Date; selectedMonthDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate: Date;
  let endDate: Date;
  let selectedMonthDate: Date;
  
  switch (range) {
    case "this-month":
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      selectedMonthDate = startDate;
      break;
    case "last-month":
      const lastMonth = subMonths(today, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      selectedMonthDate = startDate;
      break;
    case "last-60-days":
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      startDate = subDays(today, 59);
      startDate.setHours(0, 0, 0, 0);
      selectedMonthDate = startDate;
      break;
    case "last-90-days":
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      startDate = subDays(today, 89);
      startDate.setHours(0, 0, 0, 0);
      selectedMonthDate = startDate;
      break;
    default:
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      selectedMonthDate = startDate;
  }
  
  return { startDate, endDate, selectedMonthDate };
}

/**
 * GET /api/v2/dashboard
 * Get dashboard data for the current user
 */

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get range from query params or default to "this-month"
    const searchParams = request.nextUrl.searchParams;
    const rangeParam = searchParams.get("range") as DateRange | null;
    const validRange: DateRange = rangeParam && ["this-month", "last-month", "last-60-days", "last-90-days"].includes(rangeParam)
      ? rangeParam
      : "this-month";
    
    // Calculate date range based on selection
    const { startDate, endDate, selectedMonthDate } = calculateDateRange(validRange);
    
    // Load dashboard data
    const data = await loadDashboardData(selectedMonthDate, startDate, endDate);

    // Dashboard is aggregated data that changes frequently, use dynamic cache
    const cacheHeaders = getCacheHeaders('dynamic');

    return NextResponse.json(data, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

