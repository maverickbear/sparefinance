/**
 * Cash Flow Report API endpoint
 * GET /api/v2/reports/cash-flow?period=last-12-months
 * 
 * SIMPLIFIED: Core report endpoint for Cash Flow
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { ReportsCoreService } from "@/src/application/reports/reports-core.service";
import type { ReportPeriod } from "@/src/domain/reports/reports.types";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";


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

    const coreService = new ReportsCoreService();
    const cashFlow = await coreService.getCashFlow(userId, period);

    const cacheHeaders = getCacheHeaders('computed');

    return NextResponse.json(cashFlow, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching cash flow report:", error);

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
