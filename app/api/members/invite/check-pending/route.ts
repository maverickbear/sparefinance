import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * GET /api/members/invite/check-pending
 * Checks if an email has a pending invitation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Check if email has a pending invitation
    const { data: pendingInvitation } = await supabase
      .from("HouseholdMemberNew")
      .select("id, householdId, email, Household(createdBy)")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    const household = pendingInvitation?.Household as any;
    return NextResponse.json({
      hasPendingInvitation: !!pendingInvitation,
      invitation: pendingInvitation ? {
        id: pendingInvitation.id,
        householdId: pendingInvitation.householdId,
        ownerId: household?.createdBy || null,
      } : null,
    });
  } catch (error) {
    console.error("Error checking pending invitation:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to check pending invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


