import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { SubcategoryFormData } from "@/src/domain/categories/categories.validations";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    const body = await request.json();
    const { name, logo } = body;

    const service = makeCategoriesService();
    const subcategory = await service.updateSubcategory(id, { 
      name, 
      logo: logo !== undefined ? logo : undefined 
    });
    
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    
    const service = makeCategoriesService();
    await service.deleteSubcategory(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subcategory" },
      { status: 500 }
    );
  }
}

