import { NextRequest, NextResponse } from "next/server";
import { inviteMember, getHouseholdMembers, getUserRoleOptimized } from "@/lib/api/members";
import { memberInviteSchema, MemberInviteFormData } from "@/src/domain/members/members.validations";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // OPTIMIZED: Fetch members and user role in parallel
    const [members, userRole] = await Promise.all([
      getHouseholdMembers(userId),
      getUserRoleOptimized(userId),
    ]);

    return NextResponse.json({ members, userRole }, { status: 200 });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user ID
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const data: MemberInviteFormData = memberInviteSchema.parse(body);

    // Invite the member
    const member = await inviteMember(userId, data);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error inviting member:", error);

    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to invite member";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

