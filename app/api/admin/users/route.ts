import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";

// Force dynamic rendering - this route makes database calls
// Note: Using unstable_noStore() instead of export const dynamic due to cacheComponents compatibility

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/users/route.ts:9',message:'GET handler entry',data:{hasNoStore:true},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  noStore();
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/users/route.ts:8',message:'Before service call',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const service = makeAdminService();
    const users = await service.getAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    // Handle prerendering errors gracefully - these are expected during build analysis
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('bail out') ||
        errorMessage.includes('NEXT_PRERENDER_INTERRUPTED') ||
        errorMessage.includes('fetch() rejects')) {
      // During prerendering, return empty data
      return NextResponse.json({ users: [] });
    }
    
    console.error("Error fetching users:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

