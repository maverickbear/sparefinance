import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId");

    const service = makeAdminService();
    let subcategories;
    if (categoryId) {
      const all = await service.getAllSystemSubcategories();
      subcategories = all.filter(s => s.categoryId === categoryId);
    } else {
      subcategories = await service.getAllSystemSubcategories();
    }

    return NextResponse.json(subcategories, { status: 200 });
  } catch (error) {
    console.error("Error fetching system subcategories:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system subcategories" },
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
        { error: "Forbidden: Only super_admin can create system subcategories" },
        { status: 403 }
      );
    }

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
    const subcategory = await service.createSystemSubcategory({ name: name.trim(), categoryId, logo });
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error("Error creating system subcategory:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create system subcategory" },
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
        { error: "Forbidden: Only super_admin can update system subcategories" },
        { status: 403 }
      );
    }

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
    const subcategory = await service.updateSystemSubcategory(id, { name: name.trim(), logo });
    return NextResponse.json(subcategory, { status: 200 });
  } catch (error) {
    console.error("Error updating system subcategory:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update system subcategory" },
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
        { error: "Forbidden: Only super_admin can delete system subcategories" },
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
    await service.deleteSystemSubcategory(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting system subcategory:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete system subcategory" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

