import { NextRequest, NextResponse } from "next/server";
import {
  getAllSystemMacros,
  createSystemMacro,
  updateSystemMacro,
  deleteSystemMacro,
} from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const macros = await getAllSystemMacros();
    return NextResponse.json(macros, { status: 200 });
  } catch (error) {
    console.error("Error fetching system macros:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system macros" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const macro = await createSystemMacro({ name: name.trim() });
    return NextResponse.json(macro, { status: 201 });
  } catch (error) {
    console.error("Error creating system macro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system macro" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

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

    const macro = await updateSystemMacro(id, { name: name.trim() });
    return NextResponse.json(macro, { status: 200 });
  } catch (error) {
    console.error("Error updating system macro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system macro" },
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

    await deleteSystemMacro(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system macro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system macro" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

