import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeMembersService();
    await service.resendInvitationEmail(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error resending invitation email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resend invitation" },
      { status: 400 }
    );
  }
}

