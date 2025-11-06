import { NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/api/categories";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const category = await updateCategory(id, data as { name?: string; macroId?: string });
    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete category";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 
                      errorMessage.includes("Cannot delete system") ? 403 : 500;
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

