import { NextRequest, NextResponse } from "next/server";
import { getMacros, getCategoriesByMacro, getSubcategoriesByCategory, getAllCategories } from "@/lib/api/categories";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const macroId = searchParams.get("macroId");
    const categoryId = searchParams.get("categoryId");
    const all = searchParams.get("all");

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

