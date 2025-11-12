import { NextRequest, NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/api/categories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, macroId } = body;

    const category = await updateCategory(id, { name, macroId });
    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update category" },
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
    await deleteCategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete category" },
      { status: 500 }
    );
  }
}

