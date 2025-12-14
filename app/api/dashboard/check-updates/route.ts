import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeDashboardService } from "@/src/application/dashboard/dashboard.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * API route to silently check if there are new data updates
 * Returns a timestamp that changes when any relevant data is updated
 * This allows the frontend to poll silently without fetching all data
 * 
 * SIMPLIFIED: Uses simple timestamp-based checking (MAX(updated_at) from transactions)
 * Much simpler and faster than previous hash/RPC approach
 */

// Force dynamic rendering - this route uses request.url
// Note: Using unstable_noStore() instead of export const dynamic due to cacheComponents compatibility

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/dashboard/check-updates/route.ts:16',message:'GET handler entry',data:{hasNoStore:true,requestType:'Request'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // Opt out of static generation - this route uses request.url
  noStore();
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/dashboard/check-updates/route.ts:22',message:'Before accessing request.url',data:{requestType:'Request'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Use request.url for Request type (not NextRequest)
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp from client

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = makeDashboardService();
    const result = await service.checkUpdates(userId, lastCheck || undefined);

    // Log de performance (apenas em desenvolvimento)
    if (process.env.NODE_ENV === "development" && result.executionTime) {
      console.log(
        `[Check Updates] - ${result.executionTime}ms - ${result.source}`
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    // Handle prerendering errors gracefully - these are expected during build analysis
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('bail out') ||
        errorMessage.includes('NEXT_PRERENDER_INTERRUPTED')) {
      // During prerendering, return a default response
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

