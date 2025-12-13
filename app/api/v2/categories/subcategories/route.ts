import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { subcategorySchema, SubcategoryFormData } from "@/src/domain/categories/categories.validations";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { ZodError } from "zod";
import { revalidateTag } from 'next/cache';

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
    
    // Validate input using domain schema
    let validated: SubcategoryFormData;
    try {
      validated = subcategorySchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
          { status: 400 }
        );
      }
      throw error;
    }

    const service = makeCategoriesService();
    const subcategory = await service.createSubcategory(validated);
    
    // Invalidate cache
    revalidateTag('categories', 'max');
    
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    
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
      { error: error instanceof Error ? error.message : "Failed to create subcategory" },
      { status: 500 }
    );
  }
}

