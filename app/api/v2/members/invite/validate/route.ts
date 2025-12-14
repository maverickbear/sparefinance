import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeMembersService } from "@/src/application/members/members.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/members/invite/validate
 * Validate an invitation token
 * This endpoint can be called without authentication
 */

// Force dynamic rendering - this route uses nextUrl.searchParams
// Note: Using unstable_noStore() instead of export const dynamic due to cacheComponents compatibility

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/v2/members/invite/validate/route.ts:12',message:'GET handler entry',data:{hasNoStore:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // Opt out of static generation - this route uses searchParams
  noStore();
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e34e216-572f-43d2-b462-14dddc4ad11d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/v2/members/invite/validate/route.ts:18',message:'Before accessing searchParams',data:{requestType:'NextRequest'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Use nextUrl.searchParams for NextRequest (avoids prerendering issues)
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    const service = makeMembersService();
    
    console.log("[INVITE-VALIDATE] Validating token:", token.substring(0, 8) + "...");

    // Use service to validate invitation token
    const invitation = await service.validateInvitationToken(token);

    if (!invitation) {
      console.warn("[INVITE-VALIDATE] No invitation found for token");
      throw new AppError("Invalid or expired invitation token", 404);
    }

    console.log("[INVITE-VALIDATE] Invitation found:", {
      id: invitation.id,
      email: invitation.email,
    });

    // Get owner information and check if email has account using service
    const [owner, hasAccount] = await Promise.all([
      service.getOwnerInfoForInvitation(invitation.owner_id),
      service.checkEmailHasAccount(invitation.email),
    ]);

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
      },
      owner: owner ? {
        name: owner.name || owner.email,
        email: owner.email,
      } : null,
      hasAccount: hasAccount, // Indicates if email already has an account
    });
  } catch (error: any) {
    // Handle prerendering errors gracefully - these are expected during build analysis
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('bail out') ||
        errorMessage.includes('NEXT_PRERENDER_INTERRUPTED')) {
      // During prerendering, return a default response
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }
    
    console.error("Error validating invitation:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const finalErrorMessage = error instanceof Error ? error.message : "Failed to validate invitation";
    return NextResponse.json(
      { error: finalErrorMessage },
      { status: 500 }
    );
  }
}

