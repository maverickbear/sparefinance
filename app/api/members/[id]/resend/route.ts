import { NextRequest, NextResponse } from "next/server";
import { resendInvitationEmail } from "@/lib/api/members";
import { getCurrentUserId } from "@/lib/api/feature-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user ID
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Resend invitation email
    const { id } = await params;
    await resendInvitationEmail(id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error resending invitation:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to resend invitation";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

