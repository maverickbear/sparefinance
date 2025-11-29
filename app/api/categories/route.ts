import { NextRequest, NextResponse } from "next/server";
import { getMacros, getCategoriesByMacro, getSubcategoriesByCategory, getAllCategories, createCategory } from "@/lib/api/categories";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const macroId = searchParams.get("macroId");
    const categoryId = searchParams.get("categoryId");
    const all = searchParams.get("all");
    const consolidated = searchParams.get("consolidated");

    // If "consolidated" parameter is present, return both groups and categories in one call
    if (consolidated === "true" || consolidated === "") {
      const [groups, categories] = await Promise.all([
        getMacros(),
        getAllCategories(),
      ]);
      return NextResponse.json({ groups, categories }, { status: 200 });
    }

    // If "all" parameter is present, return all categories
    if (all === "true" || all === "") {
      const categories = await getAllCategories();
      return NextResponse.json(categories, { status: 200 });
    }

    // If categoryId is provided, return subcategories
    if (categoryId) {
      const subcategories = await getSubcategoriesByCategory(categoryId);
      return NextResponse.json(subcategories, { status: 200 });
    }

    // If macroId is provided, return categories for that macro
    if (macroId) {
      const categories = await getCategoriesByMacro(macroId);
      return NextResponse.json(categories, { status: 200 });
    }

    // Default: return macros
    const macros = await getMacros();
    return NextResponse.json(macros, { status: 200 });
  } catch (error) {
    console.error("Error fetching categories:", error);
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

    const category = await createCategory({ name, groupId: finalGroupId, macroId });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create category" },
      { status: 500 }
    );
  }
}

