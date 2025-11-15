import { NextRequest, NextResponse } from "next/server";
import {
  getAllSystemGroups,
  createSystemGroup,
  updateSystemGroup,
  deleteSystemGroup,
} from "@/lib/api/admin";

export async function GET(request: NextRequest) {
  try {
    const groups = await getAllSystemGroups();
    return NextResponse.json(groups, { status: 200 });
  } catch (error) {
    console.error("Error fetching system groups:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system groups" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (type && type !== "income" && type !== "expense") {
      return NextResponse.json(
        { error: "Type must be either 'income' or 'expense'" },
        { status: 400 }
      );
    }

    const group = await createSystemGroup({ 
      name: name.trim(),
      type: type || "expense"
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Error creating system group:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system group" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Name must be a non-empty string" },
        { status: 400 }
      );
    }

    if (type !== undefined && type !== "income" && type !== "expense") {
      return NextResponse.json(
        { error: "Type must be either 'income' or 'expense'" },
        { status: 400 }
      );
    }

    const updateData: { name?: string; type?: "income" | "expense" } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (type !== undefined) {
      updateData.type = type;
    }

    const group = await updateSystemGroup(id, updateData);
    return NextResponse.json(group, { status: 200 });
  } catch (error) {
    console.error("Error updating system group:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system group" },
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

    await deleteSystemGroup(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system group:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system group" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

