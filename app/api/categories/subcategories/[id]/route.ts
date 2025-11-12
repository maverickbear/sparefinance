import { NextRequest, NextResponse } from "next/server";
import { updateSubcategory, deleteSubcategory } from "@/lib/api/categories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, logo } = body;

    const subcategory = await updateSubcategory(id, { name, logo });
    return NextResponse.json(subcategory, { status: 200 });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subcategory" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSubcategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subcategory" },
      { status: 500 }
    );
  }
}

