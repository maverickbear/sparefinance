import { NextRequest, NextResponse } from "next/server";
import { createSubcategory } from "@/lib/api/categories";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, logo } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const subcategory = await createSubcategory({ name, categoryId: id, logo });
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subcategory" },
      { status: 500 }
    );
  }
}

