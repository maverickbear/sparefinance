import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

/**
 * Fast endpoint to get user role only
 * Used by FeatureGuard to check super_admin status without fetching all members
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = makeMembersService();
    const userRole = await service.getUserRole(userId);

    return NextResponse.json({ userRole }, { 
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching user role:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user role" },
      { status: 500 }
    );
  }
}

