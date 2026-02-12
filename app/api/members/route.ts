import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { memberInviteSchema, MemberInviteFormData } from "@/src/domain/members/members.validations";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
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

    const adminService = makeAdminService();
    if (await adminService.isSuperAdmin(userId)) {
      return NextResponse.json({ members: [], userRole: "super_admin" }, { status: 200 });
    }

    const service = makeMembersService();
    const [members, userRole] = await Promise.all([
      service.getHouseholdMembers(userId),
      service.getUserRole(userId),
    ]);

    return NextResponse.json({ members, userRole }, { status: 200 });
  } catch (error) {
    console.error("Error fetching members:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
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

    const service = makeMembersService();
    const member = await service.inviteMember(userId, data);

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

    // Handle AppError
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
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

