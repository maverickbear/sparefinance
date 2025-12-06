import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { CategoryFormData } from "@/src/domain/categories/categories.validations";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const macroId = searchParams.get("macroId");
    const categoryId = searchParams.get("categoryId");
    const all = searchParams.get("all");
    const consolidated = searchParams.get("consolidated");

    const service = makeCategoriesService();

    const cacheHeaders = getCacheHeaders('static');

    // If "consolidated" parameter is present, return both groups and categories
    if (consolidated === "true" || consolidated === "") {
      const [groups, categories] = await Promise.all([
        service.getGroups(),
        service.getAllCategories(),
      ]);
      return NextResponse.json({ groups, categories }, { 
        status: 200,
        headers: cacheHeaders,
      });
    }

    // If "all" parameter is present, return all categories
    if (all === "true" || all === "") {
      const categories = await service.getAllCategories();
      return NextResponse.json(categories, { 
        status: 200,
        headers: cacheHeaders,
      });
    }

    // If categoryId is provided, return subcategories
    if (categoryId) {
      const subcategories = await service.getSubcategoriesByCategory(categoryId);
      return NextResponse.json(subcategories, { 
        status: 200,
        headers: cacheHeaders,
      });
    }

    // If macroId is provided, return categories for that group
    if (macroId) {
      const categories = await service.getCategoriesByGroup(macroId);
      return NextResponse.json(categories, { 
        status: 200,
        headers: cacheHeaders,
      });
    }

    // Default: return groups
    const groups = await service.getGroups();
    return NextResponse.json(groups, { 
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

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
    const { name, macroId, groupId } = body;

    // Support both macroId (deprecated) and groupId for backward compatibility
    const finalGroupId = groupId || macroId;

    if (!name || !finalGroupId) {
      return NextResponse.json(
        { error: "Name and groupId (or macroId) are required" },
        { status: 400 }
      );
    }

    const service = makeCategoriesService();
    const category = await service.createCategory({ 
      name, 
      groupId: finalGroupId, 
      macroId: macroId || undefined 
    });
    
    // Invalidate cache
    revalidateTag('categories', 'max');
    revalidateTag('groups', 'max');
    
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create category" },
      { status: 500 }
    );
  }
}

