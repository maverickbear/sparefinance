import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { SubcategoryFormData } from "@/src/domain/categories/categories.validations";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const body = await request.json();
    const { name, categoryId, logo } = body;

    if (!name || !categoryId) {
      return NextResponse.json(
        { error: "Name and categoryId are required" },
        { status: 400 }
      );
    }

    const service = makeCategoriesService();
    const subcategory = await service.createSubcategory({ 
      name, 
      categoryId, 
      logo: logo || null 
    });
    
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subcategory" },
      { status: 500 }
    );
  }
}

