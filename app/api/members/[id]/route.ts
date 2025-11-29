import { NextRequest, NextResponse } from "next/server";
import { updateMember, removeMember } from "@/lib/api/members";
import { memberUpdateSchema, MemberUpdateFormData } from "@/src/domain/members/members.validations";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { ZodError } from "zod";

export async function PATCH(
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

    // Parse and validate request body
    const body = await request.json();
    const data: MemberUpdateFormData = memberUpdateSchema.parse(body);

    // Update the member
    const { id } = await params;
    const member = await updateMember(id, data);

    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    console.error("Error updating member:", error);

    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to update member";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;

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
    // Get current user ID
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Remove the member
    const { id } = await params;
    await removeMember(id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error removing member:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to remove member";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

