import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    const service = makeMembersService();
    const member = await service.acceptInvitation(token, userId);
    
    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to accept invitation" },
      { status: 400 }
    );
  }
}

