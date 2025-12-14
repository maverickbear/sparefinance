import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeSubscriptionServicesService } from "@/src/application/subscription-services/subscription-services.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/subscription-services
 * Get active subscription service categories and services (public endpoint)
 */

// Force dynamic rendering - this route makes database calls
// Note: Using unstable_noStore() instead of export const dynamic due to cacheComponents compatibility

export async function GET() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/subscription-services/route.ts:11',message:'GET handler entry',data:{hasNoStore:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  noStore();
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/subscription-services/route.ts:14',message:'Before service call',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const service = makeSubscriptionServicesService();
    const result = await service.getCategoriesAndServices();

    return NextResponse.json(result);
  } catch (error: any) {
    // Handle prerendering errors gracefully - these are expected during build analysis
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('bail out') ||
        errorMessage.includes('NEXT_PRERENDER_INTERRUPTED') ||
        errorMessage.includes('fetch() rejects')) {
      // During prerendering, return empty data
      return NextResponse.json({
        categories: [],
        services: [],
      });
    }
    
    console.error("Error in GET /api/subscription-services:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

