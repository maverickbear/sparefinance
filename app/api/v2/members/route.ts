import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { MemberInviteFormData, memberInviteSchema } from "@/src/domain/members/members.validations";
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
    const isPortalAdmin = await adminService.isSuperAdmin(userId);
    if (isPortalAdmin) {
      return NextResponse.json({ members: [], userRole: "super_admin" }, { status: 200 });
    }

    const service = makeMembersService();
    const members = await service.getHouseholdMembers(userId);
    const userRole = await service.getUserRole(userId);

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

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invite member" },
      { status: 500 }
    );
  }
}

