import { NextRequest, NextResponse } from "next/server";
import {
  getAllSystemSubcategories,
  getSystemSubcategoriesByCategory,
  createSystemSubcategory,
  updateSystemSubcategory,
  deleteSystemSubcategory,
} from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId");

    let subcategories;
    if (categoryId) {
      subcategories = await getSystemSubcategoriesByCategory(categoryId);
    } else {
      subcategories = await getAllSystemSubcategories();
    }

    return NextResponse.json(subcategories, { status: 200 });
  } catch (error) {
    console.error("Error fetching system subcategories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system subcategories" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, categoryId, logo } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    const subcategory = await createSystemSubcategory({ name: name.trim(), categoryId, logo });
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error("Error creating system subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system subcategory" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, logo } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const subcategory = await updateSystemSubcategory(id, { name: name.trim(), logo });
    return NextResponse.json(subcategory, { status: 200 });
  } catch (error) {
    console.error("Error updating system subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system subcategory" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    await deleteSystemSubcategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system subcategory" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

