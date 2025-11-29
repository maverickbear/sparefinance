import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { MemberUpdateFormData } from "@/src/domain/members/members.validations";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const service = makeMembersService();
    const member = await service.updateMember(id, body);
    
    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    console.error("Error updating member:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update member";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeMembersService();
    await service.removeMember(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove member" },
      { status: 400 }
    );
  }
}

