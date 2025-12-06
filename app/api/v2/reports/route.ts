import { NextRequest, NextResponse } from "next/server";
import { makeReportsService } from "@/src/application/reports/reports.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import type { ReportPeriod } from "@/src/domain/reports/reports.types";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

/**
 * Reports API endpoint
 * GET /api/v2/reports?period=last-12-months
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period: ReportPeriod = (periodParam &&
      ["current-month", "last-3-months", "last-6-months", "last-12-months", "year-to-date", "custom"].includes(periodParam)
    ) ? periodParam as ReportPeriod : "last-12-months";

    const service = makeReportsService();
    
    // Get session tokens from service
    const { accessToken, refreshToken } = await service.getSessionTokens();
    
    const data = await service.getReportsData(userId, period, accessToken, refreshToken);

    // Reports involve heavy computation, use computed cache
    const cacheHeaders = getCacheHeaders('computed');

    return NextResponse.json(data, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
