import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { MemberInviteFormData, memberInviteSchema } from "@/src/domain/members/members.validations";
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

    const service = makeMembersService();
    const members = await service.getHouseholdMembers(userId);
    
    // Get user role (temporary: using old function until migrated to service)
    const { getUserRoleOptimized } = await import("@/lib/api/members");
    const userRole = await getUserRoleOptimized(userId);

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
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data: MemberInviteFormData = memberInviteSchema.parse(body);

    const service = makeMembersService();
    const member = await service.inviteMember(userId, data);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error inviting member:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to invite member";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

