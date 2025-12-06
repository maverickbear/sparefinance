import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeDashboardService } from "@/src/application/dashboard/dashboard.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * API route to silently check if there are new data updates
 * Returns a hash/timestamp that changes when any relevant data is updated
 * This allows the frontend to poll silently without fetching all data
 * 
 * OPTIMIZED: Uses Redis cache (5s TTL) + RPC function for better performance
 */
export async function GET(request: Request) {
  // Opt out of static generation - this route uses request.url
  noStore();
  
  try {
    // Use request.url for Request type (not NextRequest)
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp from client

    const service = makeDashboardService();
    const result = await service.checkUpdates(lastCheck || undefined);

    // Log de performance (apenas em desenvolvimento)
    if (process.env.NODE_ENV === "development" && result.executionTime) {
      console.log(
        `[Check Updates] - ${result.executionTime}ms - ${result.source}`
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`[Check Updates] Error:`, error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to check updates",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

