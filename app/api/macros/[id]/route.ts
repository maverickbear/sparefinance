import { NextResponse } from "next/server";
import { deleteMacro } from "@/lib/api/categories";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteMacro(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete macro";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 
                      errorMessage.includes("Cannot delete system") ? 403 : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

