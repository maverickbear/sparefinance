import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";


export async function GET(request: NextRequest) {
  try {
    const service = makeAdminService();
    const categories = await service.getAllSystemCategories();
    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error("Error fetching system categories:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system categories" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is super_admin
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    const isSuperAdmin = await service.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only super_admin can create system categories" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, type } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!type || (type !== "income" && type !== "expense")) {
      return NextResponse.json(
        { error: "Type is required and must be either 'income' or 'expense'" },
        { status: 400 }
      );
    }
    const category = await service.createSystemCategory({ 
      name: name.trim(), 
      type: type as "income" | "expense"
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating system category:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system category" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated and is super_admin
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    const isSuperAdmin = await service.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only super_admin can update system categories" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, type } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (name === undefined && type === undefined) {
      return NextResponse.json(
        { error: "At least one field (name or type) must be provided" },
        { status: 400 }
      );
    }

    const updateData: { name?: string; type?: "income" | "expense" } = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (type !== undefined) {
      if (type !== "income" && type !== "expense") {
        return NextResponse.json(
          { error: "Type must be either 'income' or 'expense'" },
          { status: 400 }
        );
      }
      updateData.type = type as "income" | "expense";
    }
    const category = await service.updateSystemCategory(id, updateData);
    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    console.error("Error updating system category:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system category" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify user is authenticated and is super_admin
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    const isSuperAdmin = await service.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only super_admin can delete system categories" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }
    await service.deleteSystemCategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system category:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system category" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

