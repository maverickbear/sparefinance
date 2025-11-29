import { NextRequest, NextResponse } from "next/server";
import { makeAuthService } from "@/src/application/auth/auth.factory";

/**
 * POST /api/v2/auth/sign-out
 * Signs out the current user
 */
export async function POST(request: NextRequest) {
  try {
    const service = makeAuthService();
    const result = await service.signOut();
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/v2/auth/sign-out:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign out" },
      { status: 500 }
    );
  }
}

