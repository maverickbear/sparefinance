import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { makeMembersService } from "@/src/application/members/members.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/members/invite/check-pending
 * Checks if an email has a pending invitation
 */

export async function GET(request: NextRequest) {
  // Opt out of static generation - this route uses searchParams
  noStore();
  
  try {
    // Use nextUrl.searchParams for NextRequest (avoids prerendering issues)
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const service = makeMembersService();
    const result = await service.checkPendingInvitation(email);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking pending invitation:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to check pending invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


