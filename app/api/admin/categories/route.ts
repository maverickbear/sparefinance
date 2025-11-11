import { NextRequest, NextResponse } from "next/server";
import {
  getAllSystemCategories,
  createSystemCategory,
  updateSystemCategory,
  deleteSystemCategory,
} from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const categories = await getAllSystemCategories();
    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error("Error fetching system categories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system categories" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, macroId } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!macroId || typeof macroId !== "string") {
      return NextResponse.json(
        { error: "Macro ID is required" },
        { status: 400 }
      );
    }

    const category = await createSystemCategory({ name: name.trim(), macroId });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating system category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system category" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, macroId } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (name === undefined && macroId === undefined) {
      return NextResponse.json(
        { error: "At least one field (name or macroId) must be provided" },
        { status: 400 }
      );
    }

    const updateData: { name?: string; macroId?: string } = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (macroId !== undefined) {
      if (typeof macroId !== "string") {
        return NextResponse.json(
          { error: "Macro ID must be a string" },
          { status: 400 }
        );
      }
      updateData.macroId = macroId;
    }

    const category = await updateSystemCategory(id, updateData);
    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    console.error("Error updating system category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system category" },
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

    await deleteSystemCategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system category" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

